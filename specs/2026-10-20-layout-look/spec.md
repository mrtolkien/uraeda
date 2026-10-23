---
status: approved
revision: 1
clarifications: 2
risk-tier: medium
plan-review: false
---

# Spec: Layout and look and feel

> [!NOTE]
>
> Approved on 2026-10-23.
>
> - You approve the terminal look for the whole UI, a shell that fits three widths, and new home,
>   settings, and decisions pages.
> - One new decision, the UI look, and two changed ones: three width classes, and throwaway
>   prototypes in an investigation.
> - The mockups are the HTML prototypes, as you asked, not stories: this spec departs from the
>   preview decision once. The plan builds the stories first, and the prototypes go when they do.
> - Three places differ from the mockups: decisions in today's order, not by area; settings with the
>   real settings; and key hints only for keys that work.
> - Claude Code's and Codex's marks are used without their owners' approval, as you chose.
> - Not verified: whether Astryx's palette takes a preview pane. The plan's first task checks it.
> - Risk tier `medium`: every view changes look, and one browser preference changes values.

The UI takes the terminal look you picked: Catppuccin colours, one monospace font, square bordered
panes. Its shell fits a full screen, your half screen, and a phone. The home, settings, and the
decisions pages are redrawn in it. The reading pages and the lists follow in two later features. See
the [proposal](proposal.md), the discovery rounds [01](discovery-01.md) and [02](discovery-02.md),
and the clarifications [01](clarifications-01.md) and [02](clarifications-02.md).

## Decisions

- **New: [UI look](../decisions/ui-look.md)**. A terminal look in one theme: a monospace font,
  Catppuccin Mocha and Latte, square bordered panes, 120% text, bundled fonts, Lucide icons, and
  Codicons' harness marks.
- **Changed: [UI layout](../decisions/ui-layout.md)**. Three width classes instead of two: narrow,
  semi-wide, and wide.
- **Changed: [Preview](../decisions/preview.md)**. An investigation may compare throwaway prototypes
  in any format, deleted when its spec is approved.

Relied on:

| Decision                                       | What it means for this spec                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| [UI components](../decisions/ui-components.md) | Astryx stays; the titled pane, rail, status line, and palette preview are listed gaps |
| [UI coherence](../decisions/ui-coherence.md)   | one titled pane, one row, one harness mark, shared by every view                      |
| [UI behaviour](../decisions/ui-behaviour.md)   | nothing opens on hover alone: the rail opens on focus and tap too                     |
| [Settings](../decisions/settings.md)           | the file view shows the real `settings.toml`, and writes keep its comments            |
| [Problems](../decisions/problems.md)           | the home's problems are those that stop the workflow, never notes                     |
| [Stack](../decisions/stack.md)                 | the decisions reader draws the core's document tree, never markdown                   |

## User stories

### US1: The terminal look (P1)

Every page takes the theme: JetBrains Mono at 120%, Catppuccin colours, square corners, and the
dot-matrix tree as the logo and favicon. Settings switch between Mocha, Latte, and the system's.

[The look, in Mocha and Latte, and the logo](/packages/web/src/shell/Shell.stories.tsx#Wide)

Key scenarios:

1. **Given** a system in dark mode and no scheme picked, **When** the human opens the app, **Then**
   it draws in Mocha, and in Latte once the system turns light.
2. **Given** the scheme set to Latte in settings, **When** the system turns dark, **Then** the app
   stays in Latte, and does so again after a reload.
3. **Given** a session on Claude Code and one on Pi, **When** they show in the sidebar, **Then** the
   first has Codicons' Claude mark, and the second the neutral Pi glyph.

More scenarios:

1. **Given** a browser whose earlier pick was "dark", **When** it opens the new version, **Then** it
   draws in Mocha, and settings show Mocha picked.
2. **Given** no network, **When** the app loads, **Then** every font and icon draws, and no request
   leaves the machine.

### US2: A shell for three widths (P1)

The shell is a column of bordered panes: the logo and repository, New and Note, the search, then
Navigate, Needs you, Sessions, In progress, and Done, with the 5 h window and Settings at its foot.
At 1280 px and wider it is a full column. From 768 to 1279 px it folds to a 52 px rail of icons,
which opens over the page. Below 768 px it is a top bar of icon tabs. A status line at the bottom
shows the page's key hints and the counts.

[Shell, wide](/packages/web/src/shell/Shell.stories.tsx#Wide)

[Shell, semi-wide](/packages/web/src/shell/Shell.stories.tsx#SemiWide)

[Shell, narrow](/packages/web/src/shell/Shell.stories.tsx#Narrow)

Key scenarios:

1. **Given** a window 1205 px wide, **When** the home opens, **Then** the shell is a 52 px rail, and
   pointing at it, focusing it, or tapping its logo opens it over the page at its full width.
2. **Given** a window 1900 px wide, **When** the app opens, **Then** the column is 266 px wide, 14%
   of the window, and dragging its edge to 320 px keeps 320 px after a reload.
3. **Given** a phone 390 px wide and 3 running sessions, **When** the human taps the Sessions tab,
   **Then** the sessions page opens, and the tab's badge reads 3.

More scenarios:

1. **Given** the rail open over the page at 1205 px, **When** the human presses Escape or moves
   away, **Then** it folds back to 52 px.
2. **Given** a window 1440 px wide and a feature waiting on the human, **When** any page shows,
   **Then** the feature sits in the Needs you pane, and the status line reads "1 need you".

### US3: A home of core and overview (P2)

The home is centred. Above a dashed "Overview" line, the core, in this order: problems when there
are any, then Needs you, then In progress beside Sessions. Below it, widgets in two columns: the
priorities now, the usage of the 5 h window and the week, the inbox's three latest notes, and recent
activity.

[Home, wide](/packages/web/src/Home.stories.tsx#Hub)

[Home, semi-wide](/packages/web/src/Home.stories.tsx#SemiWide)

Key scenarios:

1. **Given** a feature whose `spec.md` lacks a required section, which stops the workflow, **When**
   the home opens, **Then** a red Problems pane names it first, above Needs you.
2. **Given** a window 1205 px wide, **When** the home opens, **Then** In progress and Sessions sit
   side by side, and the widgets in two columns.
3. **Given** "Layout and look and feel" waiting for answers, **When** the home opens, **Then** its
   row shows its full title, "Questions" and the round's size on a second line, and "Answer".

More scenarios:

1. **Given** nothing stops the workflow, **When** the home opens, **Then** no Problems pane shows,
   and Needs you comes first.
2. **Given** a phone, **When** the home opens, **Then** every pane is in one column, in the same
   order.

### US4: Decisions in three columns (P2)

The decisions page has the shell, the list, and the reader. The list is the active pane, its border
in the accent colour, 30% of the window on wide screens: the constitution's principles, then the
decisions, each with its icon and the first sentence of its intent. The reader is open by default. A
principle opens the whole constitution in it, at that principle. A palette, opened with `/` or "Jump
to…", finds any entry and previews the one under the cursor.

[Decisions, the constitution open](/packages/web/src/decisions/DecisionsPage.stories.tsx#Principle)

[Decisions, a changed decision](/packages/web/src/decisions/DecisionsPage.stories.tsx#ChangedDecision)

[Decisions, the palette](/packages/web/src/decisions/DecisionsPage.stories.tsx#Palette)

Key scenarios:

1. **Given** the decisions page with nothing picked, **When** it opens, **Then** the reader shows
   the constitution, and the list marks principle I.
2. **Given** the reader on principle III, **When** the human clicks "UI layout" in the list,
   **Then** the reader shows it, and the address ends in `/decisions/ui-layout`.
3. **Given** the decisions page, **When** the human presses `/` and types "noti", **Then** the
   palette lists "Notifications", and previews its intent and first rules.

More scenarios:

1. **Given** a phone, **When** the human taps "Settings" in the list, **Then** the reader replaces
   the list, with a way back to it.
2. **Given** a decision changed on this branch, **When** it opens, **Then** the reader shows the
   change as a diff before its rules.

### US5: Settings on one page (P3)

Settings is one form of bordered sections, Server, Appearance, Sign-in, Agents, Runs, and Reviews,
each row with an icon, a name, a line of help, and its control. A search at the top right filters
the rows. A Form and File switch shows `settings.toml` as written, where clicking a value with a
fixed set of values opens a picker.

[Settings, the form](/packages/web/src/settings/SettingsView.stories.tsx#Form)

[Settings, a search](/packages/web/src/settings/SettingsView.stories.tsx#Search)

Key scenarios:

1. **Given** the settings page, **When** the human types "port" in the search, **Then** only the
   Port row shows, under Server.
2. **Given** the file view, **When** the human clicks the value of `open_browser` and picks `false`,
   **Then** the file is written with its comments kept, and the form shows the switch off.

More scenarios:

1. **Given** a search with no match, "zzz", **When** it is typed, **Then** the page reads "No
   setting matches “zzz”."

### US6: Prototypes in an investigation (P3)

An investigation can compare looks as throwaway prototypes, in any format, in its feature's
`mockups` folder. The approval of the spec deletes them, and the spec's mockups are stories.

Key scenarios:

1. **Given** a feature whose discovery compares three looks, **When** the agent writes its round,
   **Then** it may link HTML prototypes in `mockups/`, and `ura check` passes.
2. **Given** that feature's spec approved, **When** the approval step runs, **Then** it deletes the
   prototypes in the same commit.

## Architecture

The look is one Astryx theme, and the layout three width classes read from it. Four parts Astryx
lacks become small shared components, as the [UI look](../decisions/ui-look.md) and
[components](../decisions/ui-components.md) decisions allow. Astryx is upgraded to 0.7 first, so the
theme is built on the version it ships with
([discovery](discovery-02.md#astryx-and-the-terminal-look)).

- **The theme** holds the Catppuccin schemes as named token pairs, the font, square corners, the
  120% scale, and the breakpoints at 768 and 1280 px. It owns every colour and size.
- **The scheme preference** keeps Mocha, Latte, or System in the browser, and resolves System.
- **The width class** turns the breakpoints into narrow, semi-wide, or wide: the one place a view
  learns its width.
- **The pane** draws a border with its title in it, and an accent when active. Every view's grouping
  uses it.
- **The shell** composes the panes into the column, the rail, or the top tabs, by width class. It
  owns what stays one tap away at each width.
- **The status line** shows the hints a page declares, and the counts.
- **The marks**: the logo and favicon, drawn once, the icon registry with its few glyphs from other
  sets, and the harness mark.
- **The home**, **the decisions page with its palette**, and **the settings page** compose these
  parts. The file view reads `settings.toml` through the server, and writes through the setters the
  form uses.
- **The skill** lets discovery link prototypes, and the approval step delete them.

Tradeoffs:

- Squaring Astryx may need more overrides into its inner elements, which an upgrade can break.
- The prototypes stay until the stories replace them, past the spec's approval this once.

## Edge cases

| Importance | Situation                                               | What happens                                               |
| ---------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| High       | A browser picked "light" or "dark" before               | it reads as Latte or Mocha, and nothing resets             |
| High       | `settings.toml` is missing or invalid                   | both views show the file's problem, as the form does today |
| High       | A write from the file view fails                        | the value stays as it was, and the error shows beside it   |
| Normal     | The rail on a touch screen, which has no pointer        | a tap on the logo opens it, and a tap outside folds it     |
| Normal     | A harness Codicons has no mark for, or an unknown one   | it gets its neutral glyph, or a generic agent glyph        |
| Normal     | The palette's search matches nothing                    | it reads "Nothing matches."                                |
| Normal     | The column dragged past its limits                      | it stops at 220 px and at 480 px                           |
| Niche      | The window crosses 1280 px with the rail open           | the rail becomes the column, and the page keeps its place  |
| Niche      | A value without a fixed set, like the port, in the file | it opens the form at that row                              |

## Success criteria

- **SC-001** (contrast): every text token reaches 4.5:1, and borders 3:1, in Mocha and Latte.
- **SC-002** (offline): the built app makes no request to another host.
- **SC-003** (half screen): at 1205 px the shell takes 52 px, and the home keeps two columns.
- **SC-004** (one pane): every bordered group on the four views is the shared pane.
- **SC-005** (palette): any of the 30 entries opens in three keys or fewer from the decisions page.

## Assumptions

The points settled in [round 01](clarifications-01.md#settled-without-the-human) and
[round 02](clarifications-02.md#settled-without-the-human) hold as written there, except the spec's
mockups, which you asked to be the HTML prototypes. Settled while writing this spec:

- **Decisions keep today's order**, newest change first or A to Z, with its sort menu. Decisions
  have no area, so the mockup's grouping by area would need a new field.
- **Settings show the real settings**, not the mockup's examples. Appearance holds the colour
  scheme, kept in this browser as today.
- **Key hints show only keys that work today**: `j` and `k` in lists, `/`, and Escape. The keyboard
  feature adds the rest.
- **What the shell keeps from today**: the repository menu on the logo, the session search,
  the ＋ on Priorities, and the latest done items in a Done pane.
- **Text is 120% at every width**, the phone included, since the mono font reads small below it.
- **Codicons' licence asks for attribution**, which the README's credits give.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional | VI. Checked code |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- | ---------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                | ✅               |

## Risk tier

**Medium**: every view changes look, and one stored browser preference changes its values. No
workflow data changes.
