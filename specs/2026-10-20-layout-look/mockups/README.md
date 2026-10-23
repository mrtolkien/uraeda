# Mockups: five directions for the layout and look

Throwaway prototypes for [the proposal](../proposal.md): the same views, the same fake data, drawn
five ways. They are clickable HTML, not shipping code. Each direction is one page, like
`natural.html`, with its styles and script in a folder of the same name.
[`compare.html`](compare.html) shows all five side by side, at a desktop, a half screen, and a phone
width. [`logos.html`](logos.html) shows five logo concepts.

## How to look at them

| Page                             | What it shows                                                        |
| -------------------------------- | -------------------------------------------------------------------- |
| [compare.html](compare.html)     | One view in all five directions, at 1440, 960, or 390 px wide        |
| [natural.html](natural.html)     | Washi paper, moss and bark, a bonsai home, a floating bottom dock    |
| [cyber.html](cyber.html)         | Violet-black and neon green, HUD panels, a branch map, a bottom dock |
| [terminal.html](terminal.html)   | LazyVim-like: tab line, status line, bordered panes, keyed home      |
| [glass.html](glass.html)         | Liquid Glass chrome around opaque reading sheets                     |
| [blueprint.html](blueprint.html) | Technical drawing sheets with a title block, callouts, rev clouds    |
| [logos.html](logos.html)         | Five logo concepts at 96, 32, and 16 px, light and dark              |
| [icons.html](icons.html)         | Seven icon sets over the same concepts, and three harness marks      |
| [screenshots/](screenshots/)     | The home and the questions page of each direction, at 1440 px        |

Inside a direction, every view is a link in its shell. The terminal direction also answers keys: `n`
new, `i` inbox, `p` priorities, `d` decisions, `s` asks the agent on the questions page, `?` shows
the key map. The natural and blueprint directions have a day/night (or cyanotype/vellum) switch, and
the glass direction follows the system theme.

## What is shared

- **Data**: [`shared/data.js`](shared/data.js). Real content from this repository: the priorities
  and inbox notes, five features and changes at different steps, four sessions on three harnesses,
  the constitution, and seven decisions. The questions and the spec are the recurring-tasks example
  from the skill, since they hold every part of a round: block, context, example, "Why it matters",
  options with pros and cons, settled points, and a decision diff.
- **Blocks**: [`shared/blocks.js`](shared/blocks.js) draws the document parts with neutral markup,
  and each direction restyles them. The shell, the home, and the lists belong to each direction.
- **Icons**: [`shared/icons.js`](shared/icons.js), 49 icons drawn for the mockups. The harness marks
  in it are stand-ins, never the official logos.

## Views drawn in every direction

Home, inbox, priorities, a feature's page, the questions page (with the session beside it), the spec
(decision diff and a framed live preview), a session, the New page, the constitution with decisions,
and settings. Not drawn: the proposal and discovery pages (rendered markdown, as the proposal says),
a file page, the plan, and the draft editor. Each direction is checked at 1440, 960, and 390 px
wide.

## The directions

### Natural

- **Idea**: a calm garden. The name comes from bonsai: 裏枝 is the back branch that gives the tree
  depth. The home is a bonsai where each feature is a branch, and a branch waiting for you has
  blossoms.
- **Look**: washi paper with a faint grain, moss `#5b7f3f`, pine, bark `#6a4a30`, clay and cherry
  accents. Fraunces for headings, Newsreader for reading, Figtree for controls. Leaf-shaped corners.
  A night version of the same palette.
- **Shell**: no sidebar. A floating dock at the bottom holds Home, Inbox, Priorities, New, Sessions,
  Features, Decisions, and Settings. Running sessions and in-progress features open as a list above
  it. A water-level drop shows the 5 h window. Content gets the full width.
- **Home**: the bonsai, then the things that need you as cards, then four count tiles.
- **Inbox**: notes as paper slips in category trays. A chosen note shows its actions inline.
- **Priorities**: four panes that scroll sideways. Ongoing is green and large, Later is faded.
- **Feature**: a growth line of eight steps, leaves for done and a bud for the current one.
- **Questions**: one centered serif column. The goal is a pull quote, "Why it matters" is a sun
  callout, the example is a water-blue callout. The session rises as a bottom sheet over the page.
- **Spec**: decisions first as tablets with a red top edge when changed. The live preview sits in a
  wooden frame with a "Live preview" label.
- **New**: a seed, a sprout, and a tree for session, change, and feature.
- **At 960 px**: the same, content a little narrower. **At 390 px**: the tree becomes a list of
  branches, and Decisions and Settings move to the top bar.

### Cyber

- **Idea**: a HUD, in the colours of the author's own sites ("Eva Unit-01": `#0a0710` violet-black,
  `#8dff5a` neon green, `#7c3fd0` violet). The author's sites are calmer than this: chamfered
  panels, hazard stripes, and parallax layers are new.
- **Look**: chamfered panels with corner brackets, a glitch on the wordmark and feature titles,
  scanlines, a perspective-free parallax of three background layers that follows the pointer.
  Rajdhani for titles, Inter for reading, JetBrains Mono for labels.
- **Shell**: a left icon rail, a top bar with Note, New, and a ring for the 5 h window, and a bottom
  dock that always lists running sessions and features in progress.
- **Home**: a hazard-striped alert for what needs you, and a branch map: one git-style branch per
  feature with eight ticks, a pulsing ring where you are the next step.
- **Inbox**: category buttons and cards; the chosen note opens in a side panel.
- **Priorities**: four lanes, each its own colour, with the rank on every card.
- **Feature**: a segmented step bar like a health bar, then stat boxes.
- **Questions**: an amber alert block for the round's summary, a bright goal panel, sticky question
  headers, option cards with chamfered corners. The session is a "comm link" panel that slides in
  from the right.
- **New**: three tall cards, cyan, violet, and green, with big glyphs.
- **At 960 px**: the right column folds away. **At 390 px**: the rail becomes a bottom bar.

### Terminal

- **Idea**: a LazyVim session in the browser, in the author's own Catppuccin Mocha colours. Highly
  textual, keyboard hints everywhere.
- **Look**: JetBrains Mono for all chrome, a proportional font only inside long prose. Panes have
  their title set into the border. Key letters are orange.
- **Shell**: a tab line on top (each running feature is a tab, a dot shows its state), a status line
  at the bottom with a mode pill, the branch, breadcrumbs, and counts.
- **Home**: a pixel bonsai, then keyed lists: needs you (1-9), keymaps, running sessions.
- **Inbox and priorities**: look like a Neovim buffer: bullets, relative line numbers, a selected
  line, `##` headings, a hint bar of keys.
- **Feature**: a left pane with the steps as a git graph, a center with stats and files, a right
  pane with sessions.
- **Questions**: an outline pane (like the Aerial sidebar), the cards in the center, and `s` opens
  the session as a terminal split below.
- **New**: a picker overlay with a list and a preview pane, like the snacks picker.
- **At 960 px**: side panes fold. **At 390 px**: tabs scroll, panes fill the width.
- **Limit**: the keys are look-only here, since keyboard navigation is its own item in the
  priorities.

### Glass

- **Idea**: Apple's Liquid Glass, used the way Apple's guidelines say: glass for navigation and
  overlays, never for the content. Every reading surface is an opaque sheet.
- **Look**: a soft moving colour wallpaper under the glass. Blur and saturation only, with no
  refraction, which works in WebKit. Inter for chrome, Newsreader for reading. Light and dark.
- **Shell**: a floating glass sidebar with Home, Inbox, Priorities, then "Needs you", "Sessions",
  and "In progress" groups, then Decisions and Settings, and the 5 h window at the foot. A glass
  toolbar holds the title and the Note and New buttons.
- **Home**: widgets. An orange "needs you" widget, a live agents widget, rings for each feature
  (Fitness style), and three small tiles.
- **Inbox**: an inset grouped list per category, with the note's actions in a glass inspector.
- **Priorities**: four colored tiles (Ongoing, Now, Next, Later) like Reminders' smart lists, then
  the groups with the rank on each row.
- **Questions**: a glass bar over the page with the question pills, and the session as a glass sheet
  with three heights: peek, half, and full. It turns opaque at full height.
- **Spec**: the live preview in a phone-shaped bezel.
- **New**: three big gradient cards.
- **At 960 px**: the sidebar becomes an icon column. **At 390 px**: a bottom tab bar.

### Blueprint

- **Idea**: the app is a set of drawing sheets, which suits long documents. The footer is a title
  block, line weight shows importance, and questions are numbered callouts.
- **Look**: cyanotype blue with white and yellow lines, or light vellum. IBM Plex Sans, Mono, and
  Serif, with Barlow Condensed for titles. A drafting grid in the background.
- **Shell**: a "drawing list" on the left (sheets, needs you, running, in progress), a tab bar on
  top, and a title block at the bottom: project, sheet title, feature, step, sheet number, revision,
  and the agents running.
- **Home**: a process plan: the eight steps on a line, each feature a diamond standing at its step,
  and a "human gate" mark. Below it, a drawing register table with a ruler of progress.
- **Inbox**: a punch list table with numbers and checkboxes.
- **Priorities**: a schedule where line weight carries the order: Ongoing is thick and green, Later
  is thin and dashed.
- **Questions**: a yellow "attention" block, a goal in a large italic serif, numbered question
  callouts with a leader line, and the session as a "notes" column on the right.
- **Spec**: changed decisions get a red revision cloud, and the live preview is a "Detail A" view
  with dimension marks.
- **New**: three sheet sizes: a dashed sketch, a detail, and a plan set.
- **At 960 px**: the drawing list folds to three-letter labels and the notes column becomes an
  overlay. **At 390 px**: a bottom list bar and a three-cell title block.

## Round 2: the picked direction, terminal with a little cyber

After the first round's answers, [terminal-2.html](terminal-2.html) redraws the shell and four
pages. The bar on top picks the colour scheme (Catppuccin Mocha or Latte), and a frame width (auto,
1440, 1205, 960, or 390), so a half screen can be tried without resizing the window. The choices
stay in the address.

- **Picked**: the shell with stacked bordered panes (as in edgy.nvim), the home with two columns,
  and the form settings with a search at the top right.
- **Width classes**: wide (1280 px and up) is a full left column. Semi-wide (768 to 1279 px) is an
  icon column that opens over the page on hover or focus. Narrow (under 768 px) is a top tab bar of
  icons. Page content is centred, and the home keeps two columns down to the semi-wide class.
- **Home**: the same bordered panes as the sidebar, split by a dashed "Overview" line. Above it, the
  core: problems, needs you, in progress, and sessions. Below it, widgets: the priorities now, usage
  of the 5 h window and the week, an inbox glimpse, recent activity, and shortcuts.
- **Settings**: a form of bordered sections with an icon on every row, a search, and a Form/File
  switch. The file view is `settings.toml`, where clicking a value opens a picker.
- **Decisions**: the real ones. [`terminal-2/real.js`](terminal-2/real.js) is generated from
  `specs/decisions/*.md`, `specs/CONSTITUTION.md`, and the Lucide icons the decisions name. Three
  columns in the sidebar's bordered-pane style: the navigation, the list (the active pane, in mauve,
  wider on wide screens), and the entry, open by default with previous, next, and close. The
  constitution keeps its six principles in the list, and each opens the one file at its section. A
  palette (`/` or "Jump to…") searches every entry and previews the one under the cursor. The
  selection is in the URL. On a phone the entry replaces the list.
- **Status bar**: key hints for the page (the keys are drawn, not built).
- **Sidebar width**: 14% of the window between 256 and 340 px, and draggable (double-click resets).
- **Not redrawn**: the other pages link to the first round's terminal mockup.

## Contrast

Text colours were measured against WCAG 2.2 AA (4.5:1 for text, 3:1 for large text and controls).
The first drafts of several secondary text colours missed it, such as the grey hints of the natural
direction (3.2:1) and the glass direction (3.6:1), and the white text on the glass orange widget
(2.1:1). They were raised, and the numbers are in the
[discovery](../discovery-01.md#contrast-of-the-mockups-own-colours). Decorative marks, like grid
lines, are not text.

## What these are not

- They are not Storybook stories and not built with Astryx. The active
  [preview decision](../../decisions/preview.md) says mockups MUST be stories. The proposal and the
  human's request here ask for throwaway HTML, so these are HTML. The round asks what to do about
  this.
- They load fonts from Google Fonts, so they need a network connection for the intended look.
- They fake everything: no data comes from the server, and no input is saved.
- They were checked in Chromium. They were not checked in Safari or Firefox.
- An image-generation tool was tested and works, but is not used: pictures of interfaces cannot be
  clicked, and their text is unreliable.
