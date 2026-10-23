---
status: awaiting-human
---

# Clarifications, round 02: Layout and look and feel

> [!IMPORTANT]
>
> 2 questions, about 10 minutes.
>
> - Verdict: worth building, with changes: the shell, home, settings, and decisions are settled in
>   the mockups, and two visual choices remain.
> - Open the [icon comparison](mockups/icons.html) first: it draws the same concepts in seven sets,
>   one in three styles.
> - The icon set outlasts this feature: every later view and every decision's icon uses it.
> - The harness marks are a legal choice: the Claude glyph you found is the trademarked mark.
> - Astryx stays, re-themed, as an answer to your note. Four small parts are our own components.
> - Your picks from the mockup review are written down as settled points: check them once.

## Context

### Since the last round

You answered [round 01](clarifications-01.md), then reviewed a second set of mockups over the
terminal direction, [terminal-2.html](mockups/terminal-2.html), and asked to move to the spec. Two
answers of round 01 asked for more: icon sets "shown visually", and a Claude glyph from Nerd Fonts
for the harness marks. A note also asked whether Astryx still fits.

### Goal

This feature restyles the shell, the home, settings, and the decisions pages in the terminal look.
It also sets the identity every later view inherits: colours, type, logo, and icons.

### Today

| Part          | Today                                                                            |
| ------------- | -------------------------------------------------------------------------------- |
| Icons         | 53 Lucide icons copied into [icons.ts](/packages/web/src/theme/icons.ts)         |
| Harness marks | None: sessions show the harness's name                                           |
| Decisions     | Each names a Lucide icon in its `icon` field, which the decisions page draws     |
| Components    | Astryx 0.6.8 over StyleX, themed in [theme.ts](/packages/web/src/theme/theme.ts) |

### Scope

Only the icon set and the harness marks. Everything else of this feature is settled, below.

### Sources

- The sets' licences and sizes from the Iconify API, Nerd Fonts' glyph names, and Astryx's own
  source.
- The full investigation is in [discovery](discovery-02.md).

## Q1: Which icon set should the UI use?

[icons.html](mockups/icons.html) draws 31 concepts in seven sets, with Material Symbols in its
outlined, rounded, and sharp styles. A sidebar like yours comes first, then one concept per row.
Switch between 16, 20, and 24 px, and between Mocha and Latte. More in
[discovery](discovery-02.md#icon-sets).

| Set                   | Licence     | Icons           | Gaps among the 31 concepts                |
| --------------------- | ----------- | --------------- | ----------------------------------------- |
| Lucide                | ISC         | 1,903           | None                                      |
| Tabler                | MIT         | 6,238           | None                                      |
| Pixelarticons         | MIT         | 1,036           | Build, change, usage, decisions           |
| Codicons (Nerd Fonts) | CC BY 4.0   | 655             | Decisions, waiting, usage                 |
| Phosphor, Material    | MIT, Apache | 7,000 to 15,700 | None, but a look apart from the mono text |

Each decision's `icon` field holds a Lucide name. A set other than Lucide means renaming the icons
of all 24 decisions, and the rule in the skill.

Why it matters: icons mark every row of the app. The set you pick is the one every later feature
draws from.

- **A (recommended). Lucide, as today.**
  - [pro] no migration, every concept covered, and the decisions' icon names stay valid.
  - [con] the neutral rounded stroke adds no character of its own to the terminal look.
  - Why recommended: it covers everything at no cost, and the comparison shows it at ease in the
    mono rows.
- **B. Tabler.**
  - [pro] the same look with three times as many icons, for later views.
  - [con] the 24 decisions' icon names and the skill's rule change.
- **C. Pixelarticons, with its gaps filled from Lucide.**
  - [pro] the pixel look matches the dot-matrix logo, the most distinctive option.
  - [con] four of the 31 concepts come from another set, and pixel art blurs at 16 px.
- **D. Codicons, the Nerd Fonts look, with its gaps filled from Lucide.**
  - [pro] the look of an editor, and it carries the Claude and OpenAI marks of the next question.
  - [con] the smallest set, three gaps already, and thin 16 px shapes look faint at 120% text.

**Answer:**

## Q2: How should a session show which harness runs it?

A harness is the agent program that runs a session, such as Claude Code or Codex. The glyph you
found in Nerd Fonts, ``, is Codicons' `claude` icon: the real Claude mark, as VS Code draws it.
Codicons also has OpenAI's mark, and none for Pi, Gemini CLI, or opencode. Anthropic's guidelines
allow its marks "only as specifically permitted by us", and forbid changing their colour. The bottom
of [icons.html](mockups/icons.html) shows the three options in session rows. More in
[discovery](discovery-02.md#harness-marks).

Example: four sessions run, on Claude Code, Codex, Pi, and Gemini CLI.

Why it matters: the mark is how you tell sessions apart at a glance, and using a trademark is your
call to make.

- **A (recommended). Neutral glyphs drawn for Uraeda, one per harness, beside its name.**
  - [pro] no trademark question, every harness gets one, and they follow the theme's colours.
  - [con] you learn which glyph is which, instead of recognising a logo.
  - Why recommended: it is the only option where all four sessions get a mark without permission.
- **B. Codicons' marks for Claude Code and Codex, as in Nerd Fonts, and neutral glyphs for Pi and
  Gemini CLI.**
  - [pro] the two you use most are recognised at once, in a monochrome style that fits the look.
  - [con] two marks used without Anthropic's or OpenAI's approval, drawn in the theme's colour.
- **C. The official logos from Simple Icons, for Claude, OpenAI, and Gemini.**
  - [pro] the most recognisable.
  - [con] the same trademark question for three marks, and logos that clash with the mono rows.

**Answer:**

## Settled without the human

### Check these

- **Astryx stays**, re-themed for the terminal look. Its theme sets square corners, the mono font,
  and the type scale. It also sets the Catppuccin colours and the width classes. Four parts have no
  Astryx component: a titled pane, the status line, the rail over the page, and the palette's
  preview. They become four small components of ours, as the
  [components decision](/specs/decisions/ui-components.md) allows. Another system would need the
  same four, and a rewrite of 181 files. See
  [discovery](discovery-02.md#astryx-and-the-terminal-look).
- **Astryx is upgraded to 0.7 first**, so the new theme is built against the version it ships on. It
  stays pinned to an exact version.
- **The spec's mockups are stories with the real components**, as your answer on prototypes asked.
  The HTML prototypes are deleted when the spec is approved, and git keeps them.
- **The picks of the mockup review**, from your session on 2026-10-23, are what the spec writes
  down. They are the bordered-pane shell, and the home split by an "Overview" line. Then the
  settings form with a search and a file view, the three-column decisions page, and the key hints.
  The full list is in [discovery](discovery-02.md#the-mockup-review).
- **No "reduce effects" setting**, since you found it pointless. The system's reduced-motion setting
  still stops the pulsing dots.

### Behaviour

- **The width classes** are narrow under 768 px, semi-wide from 768 to 1279 px, and wide from 1280
  px. Your 1205 px half screen is semi-wide, as the mockups show.
- **The status line's keys are drawn, not built**: keyboard navigation is the feature after the text
  editor, as you said.
- **The colour schemes** are Mocha and Latte, picked in settings or following the system. The theme
  holds them as named schemes, so more can come later.

### Under the hood

- **One bundled font**, JetBrains Mono, under the SIL Open Font License, served by the app. No
  request leaves the machine.
- **The logo** is drawn as an SVG on an 8 by 8 grid, and the favicon from the same drawing.

**Notes:**
