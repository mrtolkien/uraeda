# Discovery, round 02: Layout and look and feel

## Why this round

Three things from [round 01](clarifications-01.md) stay open before the spec:

- The icon set: the human picked Lucide, but asked to be "shown more options and see them visually",
  since two options were hard to compare.
- The harness marks: the human picked neutral glyphs, then noted that Nerd Fonts already has a
  Claude Code glyph, ``.
- A note asked whether Astryx still fits the terminal look, or whether another component system is
  needed.

Between the rounds, the human also reviewed a second set of mockups over the picked direction,
terminal with some cyber, in [terminal-2.html](mockups/terminal-2.html). Its picks are recorded in
[The mockup review](#the-mockup-review), so the spec builds on them.

## Summary

Seven free icon sets were drawn over the same 31 concepts, in [icons.html](mockups/icons.html). They
split into three looks: rounded strokes (Lucide, Tabler, Phosphor), pixel art (Pixelarticons), and
the editor sets that Nerd Fonts merges (Codicons, Material Design Icons, Material Symbols). The
Claude glyph the human found is Codicons' own `claude` icon, which also has an `openai` one. Astryx
covers most of the terminal look through its theme, and four small parts need components of our own
under any library.

## How other products do it

### Icon sets

Each set's licence and size come from the Iconify collections API, read on 2026-10-23
(`api.iconify.design/collections`). The bodies drawn in [icons.html](mockups/icons.html) were
fetched from the same API.

| Set                     | Licence    | Icons  | Look                                              |
| ----------------------- | ---------- | ------ | ------------------------------------------------- |
| Lucide                  | ISC        | 1,903  | Even 2 px strokes, rounded ends. The app's today. |
| Tabler                  | MIT        | 6,238  | Like Lucide, with three times as many icons.      |
| Phosphor                | MIT        | 9,072  | Softer, wider, in six weights.                    |
| Pixelarticons           | MIT        | 1,036  | Pixel art on a 24 grid, like the logo.            |
| Codicons                | CC BY 4.0  | 655    | VS Code's set, on a 16 grid, thin and squared.    |
| Material Symbols, sharp | Apache 2.0 | 15,728 | Google's set, filled shapes, sharp corners.       |
| Material Design Icons   | Apache 2.0 | 7,447  | The largest source of Nerd Fonts glyphs.          |

- **Coverage**: Pixelarticons has no build, change, or usage icon that reads as such, and its
  "decisions" scale was the closest match, an arrow. Codicons has no scale, waiting, or usage icon.
  Lucide, Tabler, Phosphor, and the Material sets cover all 31 concepts.
- **The decisions name Lucide icons.** A decision's `icon` field holds a Lucide name, by the skill's
  rule ([spec.md](/skills/uraeda/references/spec.md#writing-a-decision)). Another set means a map
  from those names, or new names in all 24 decisions and the skill.
- **Nerd Fonts** is a font that merges several sets into one, for terminals: Codicons, Material
  Design Icons, Octicons, Font Awesome, and others
  ([glyphnames.json](https://github.com/ryanoasis/nerd-fonts/blob/master/glyphnames.json), read). A
  Nerd Fonts look in the browser means drawing those sources as SVG, which the comparison does.

### Harness marks

- ``, the glyph the human found, is `cod-claude` in Nerd Fonts' glyph names: Codicons' own `claude`
  icon. Codicons also has `openai` at ``, and Copilot marks. It has none for Pi, Gemini CLI, or
  opencode ([glyphnames.json](https://github.com/ryanoasis/nerd-fonts/blob/master/glyphnames.json),
  read; the bodies from the Iconify API).
- Codicons' CC BY 4.0 licence covers the drawing. The marks stay their owners' trademarks.
  Anthropic's guidelines allow its marks "only as specifically permitted by us", and forbid changes
  to colour ([read in round 01](discovery-01.md#harness-marks-and-trademarks)).
- Simple Icons draws the official logos of Claude, OpenAI, and Gemini, under CC0, with the same
  trademark caveat ([round 01](discovery-01.md#harness-marks-and-trademarks)).

### What they have in common

Terminal tools mark things with editor icon fonts, and apps with stroke sets. Every set above draws
the same concepts on a 16 or 24 grid, so any of them fits the shell's rows. The marks of the agent
products are trademarks under every set that draws them.

## Standards and libraries

### Astryx and the terminal look

Facts from Astryx 0.6.8's source in `node_modules/@astryxdesign/core/src`, and the app's
[theme.ts](/packages/web/src/theme/theme.ts):

- **The theme covers the look.** `defineTheme` takes `radius: { multiplier: 0 }`, documented as
  "Sharp/brutalist — all radii become 0". It also takes font families, a type scale, 79 colour
  tokens as light and dark pairs, shadows, and named width breakpoints. Catppuccin's two palettes
  map onto the colour pairs. Lavender has no slot and becomes a local token.
- **Components get new variants** through the theme's `components` overrides, which is how the
  segmented control and the switch take the mockup's look. `Item` has a density and line counts for
  two-line rows. `TabList` draws icon-only tabs.
- **Four parts have no Astryx component**: a pane with its title in its border, the status line, a
  rail that opens over the page, and a palette with a preview pane. `CommandPalette` has no preview
  slot, and its inline mode is "for documentation previews and showcases only"
  (`CommandPalette.doc.mjs`). The [components decision](/specs/decisions/ui-components.md) allows a
  raw element for a missing component, with a reason.
- **Version**: Astryx is "Currently in Beta"
  ([facebook/astryx](https://github.com/facebook/astryx)). The app pins 0.6.8, and 0.7.3 shipped on
  2026-10-22.

### Other component systems

| Option                         | Licence, version              | What it would change here                                                        |
| ------------------------------ | ----------------------------- | -------------------------------------------------------------------------------- |
| Base UI, unstyled              | MIT, 1.9.0                    | Every style, state, and focus ring written by us. No chat, markdown, or sheet.   |
| React Aria Components          | Apache-2.0, 1.22.1            | The same, with stronger keyboard handling.                                       |
| shadcn/ui on Radix             | MIT                           | Brings Tailwind, a second styling system the stack and components rule out.      |
| WebTUI, a terminal CSS library | MIT, 0.1.10, about 2.5k stars | A global stylesheet, which the components decision forbids. No behaviour at all. |

Sources: [@base-ui/react](https://www.npmjs.com/package/@base-ui/react),
[react-aria-components](https://www.npmjs.com/package/react-aria-components),
[@webtui/css](https://www.npmjs.com/package/@webtui/css) and its
[boxes](https://webtui.ironclad.sh/start/ascii-boxes/). None of them has the four missing parts.

## The code

### Important reads

- [theme.ts](/packages/web/src/theme/theme.ts) (194 lines): one `defineTheme` over the neutral
  theme, with three overrides that reach into Astryx's inner elements.
- The app imports `@astryxdesign` 700 times in 181 files, from about 55 modules, among them `Chat`,
  `Markdown`, `CodeBlock`, `Table`, `Resizable`, and `BottomSheet`. 100 files use StyleX.
- [icons.ts](/packages/web/src/theme/icons.ts) copies 53 Lucide icons today.

### The proposal's path and existing actions

Unchanged from [round 01](discovery-01.md#the-proposals-path-and-existing-actions).

### Rules and their owners

Unchanged from [round 01](discovery-01.md#rules-and-their-owners).

### Likely changes

- The icon set, under every option: [icons.ts](/packages/web/src/theme/icons.ts), the theme's icon
  registry, and the decisions' `icon` fields if the set is not Lucide.
- The harness marks: one component that draws a harness's mark, used by every session row.

## The proposal

### The mockup review

The human reviewed [terminal-2.html](mockups/terminal-2.html) over several passes, in a session, on
2026-10-23. Each pick below is theirs:

- **Direction**: terminal, with Catppuccin Mocha and Latte, JetBrains Mono, square corners, and a
  120% text scale. From cyber, only small touches: a segmented step bar.
- **Logo**: the dot-matrix tree, concept E of [logos.html](mockups/logos.html), in the shell and as
  the favicon.
- **Shell**: a left column of stacked bordered panes, each with its title set into its top border.
  The panes are Navigate, Needs you, Sessions, In progress, and the 5 h window with Settings.
- **Shell widths**: wide is a full column, about 14% of the window between 256 and 340 px, resizable
  by its edge. Semi-wide is a 52 px icon rail that opens over the page on hover or focus. Narrow is
  a top bar of icon tabs. The human asked for a narrower column than the first 20%.
- **Width classes**: narrow under 768 px, semi-wide from 768 to 1279 px, wide from 1280 px. The
  human's half screen is 1205 px wide.
- **Home**: no pixel art, only content, centred. Above a dashed "Overview" line, the core: problems
  when there are any, then Needs you, then In progress beside Sessions. Below it, widgets: the
  priorities now, usage of the 5 h window and the week, an inbox glimpse, and recent activity. Two
  columns at semi-wide too. The human removed a shortcuts widget.
- **Settings**: one form of bordered sections, an icon on each row, and a search at the top right. A
  Form and File switch shows the same settings as `settings.toml`, where clicking a value opens a
  picker of its values.
- **Decisions**: three columns, the sidebar, the list, and the reader. The list is the active pane,
  in the accent colour, 30% of the window on wide screens. It holds the six principles of the
  constitution, then the decisions by area, each with its icon and a one-line summary. Clicking a
  principle opens the whole constitution in the reader, at that principle. The reader is open by
  default, with previous, next, and close. A palette, opened with `/` or "Jump to…", searches every
  entry and previews the one under the cursor. The human rejected six other layouts on the way: a
  second index column, a top strip, the index inside the sidebar, inline reading, and others.
- **Status line**: key hints for the page, with the counts at the right. The keys are drawn, not
  built: keyboard navigation is its own feature.

### The human's note on Astryx

The note asked whether Astryx still fits, or whether another component system is needed. The
evidence says Astryx fits: see [Astryx and the terminal look](#astryx-and-the-terminal-look). No
active decision changes, so it is a settled point of the round.

## Worth it and feasibility

Both open questions are cheap whatever the answer. Every set is free to bundle, and only the icon
registry and, for a set other than Lucide, the decisions' icon names change. Keeping Astryx avoids
rewriting 181 files.

## Approaches

### Icon set

1. **Lucide**, as today: no change, the decisions' icon names stay valid.
2. **Tabler**: the same look, more icons, and a map from the decisions' Lucide names.
3. **Pixelarticons**: a pixel look that matches the logo, with gaps filled from another set.
4. **Codicons**: the Nerd Fonts and VS Code look, the harness marks included, with gaps filled from
   another set.

### Harness marks

1. **Neutral glyphs drawn for Uraeda**, one per harness.
2. **Codicons' marks for Claude and OpenAI**, as Nerd Fonts has them, and neutral glyphs for the
   others.
3. **The official logos** from Simple Icons, for those it has.

### Needs no choice

- **Astryx stays**, re-themed, with four small components of our own. See
  [Astryx and the terminal look](#astryx-and-the-terminal-look).
- **An Astryx upgrade to 0.7** before the re-theme, so the theme is built against the version it
  ships on. Exact versions stay pinned, as the components decision asks.

## Not checked

- Anthropic's or OpenAI's view of Codicons' marks in a third-party tool: no statement was found.
- Whether Astryx 0.7.3 changed the theme levers above: its changelog was not read.
