---
status: answered
---

# Clarifications, round 01: Layout and look and feel

> [!NOTE]
>
> Answered on 2026-10-23.
>
> - Verdict: worth building, with changes: it is too big for one spec as proposed, and three active
>   decisions bind it.
> - Open the five mockups (`mockups/compare.html`, deleted) before the questions. They are clickable
>   HTML over the same data, checked at a desktop, a half screen, and a phone width.
> - The split comes first, since it decides what this feature's spec holds. Four answers work
>   together: the direction, the mixed parts, the session beside a page, and the width classes.
> - Three answers last beyond this feature. They are the direction, the width classes (which amend
>   the layout decision), and prototypes in the workflow (which amend the preview decision).
> - The mockups break the active preview decision, as you asked: they are plain HTML, not stories.
>   To lint them, the repository's lint config now ignores `specs/**/mockups/**`. Q6 can remove it.
> - Three settled points need your check: keys are drawn but not built, the questions page stays one
>   scroll, and secondary text was raised for contrast.
> - Not verified: the mockups ran in Chromium only, and not inside Uraeda's own mockup page.

## Context

### Goal

The [proposal](proposal.md) asks for one design pass over the whole web UI, for the one human who
uses it daily. The layout and the visual identity are decided together. You set what each view
shows. The agent builds several directions over that, and you pick one to write into the spec.

### Today

The UI is grey, with a black-and-white accent, and has no logo or favicon. It grew view by view. It
has one width breakpoint, at 768 px. A half screen of 960 px gets the desktop layout, where a
sidebar, a page, and a 320 px aside compete for the room.

| Part          | Today                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Shell         | A resizable side navigation in [Shell.tsx](/packages/web/src/Shell.tsx), 280 px wide by default     |
| Theme         | Astryx's neutral theme, built from [theme.ts](/packages/web/src/theme/theme.ts)                     |
| Width classes | Two, from [useWidthClass.ts](/packages/web/src/layout/useWidthClass.ts), switching at 768 px        |
| Home          | Tiles and lists in [Home.tsx](/packages/web/src/Home.tsx), with the sidebar's icons not reused      |
| Icons         | Lucide, 29 in the theme and 53 copied into [icons.ts](/packages/web/src/theme/icons.ts)             |
| The 5 h limit | A widget in [Allowance.tsx](/packages/web/src/sidebar/Allowance.tsx), hidden when the sidebar folds |

The merge-chats feature, merged before this one, already makes "session" the one concept that grows
into a change and then a feature. It also adds the New page and removes the feature colour. This
feature builds on that.

### Scope

All the views of your information architecture, the shell, the visual identity (colours, shapes,
type, a logo, a favicon), the icons, and the harness marks. It leaves out new features and any
change to what the views do. The markdown proposal editor is Q1.

### Sources

- The [current UI code](/packages/web/src/) and its sandbox of sample projects.
- The active decisions on [layout](/specs/decisions/ui-layout.md),
  [components](/specs/decisions/ui-components.md), [preview](/specs/decisions/preview.md), and
  [stack](/specs/decisions/stack.md).
- DeepSeek Harness, Kiro Crew, Zed, and the agent tools' own apps. Apple's Liquid Glass material.
  Japanese bonsai and colour sources. Your own two sites and your Neovim screenshots.
- Markdown editor tests, run on this repository's own files.
- The full investigation is in [discovery](discovery-01.md). Each question links its topic.
- The mockups are described in [their README](mockups/README.md).

## Q1: How should this work be split into features?

The proposal is one design pass over every view. A spec for all of it would pass the workflow's
split rule. The rule proposes a split past 6 stories, 30 scenarios, or 2 changed decisions. Count
each group of views as a story. The groups are the shell, home, lists, a feature's page, reading
pages, session, New page, decisions pages, and identity. The pass would also change the layout,
preview, and components decisions. A spec that large cannot be approved in one sitting. The
discovery counts them in [the split](discovery-01.md#the-split).

The markdown editor is a separate matter. You asked for a good editor for proposals, because Neovim
is still smoother. The proposal allows a big text input instead. WYSIWYG editors (Tiptap, Milkdown,
Lexical) rewrite your markdown: on this repository's files they turned the frontmatter into a
heading, escaped `> [!NOTE]` and `[[wikilinks]]`, or flattened nested lists. Only a text-buffer
editor keeps the file as written. The [stack decision](/specs/decisions/stack.md) also says the web
UI MUST draw workflow files from the core's document tree, never parsing markdown.

Why it matters: it decides how many specs you review, in which order, and when each part of the UI
changes. Your answers in this round (direction, tokens, width classes) apply to every part either
way.

- **A (recommended). Three features in order, and the editor later as its own feature. First, this
  one: the direction, the identity (tokens, type, icons, logo, harness marks), the shell, the width
  classes, the home, settings, and the decisions pages. Second, the reading pages: questions, spec,
  plan, and the session beside them. Third, the lists and starts: inbox, priorities, a feature's
  page, and New.**
  - [pro] each spec fits a sitting. You see the shell and the identity live before the rest is
    built, and each later feature inherits the tokens, so it decides little.
  - [con] three approvals instead of one, and until the later features land, some pages keep the old
    look beside the new shell.
  - Why recommended: it is the split the rule asks for, and the first feature fixes what the others
    share.
- **B. One feature for every view, with the editor left out and the proposal's text input
  restyled.**
  - [pro] one approval, and no page keeps the old look.
  - [con] a spec over the split rule, reviewed with its three decision changes in one sitting.
- **C. One feature for every view, including a markdown editor.**
  - [pro] everything you listed lands together.
  - [con] the largest spec, and an editor with its own risks. Its choice is the follow-up below.

**Answer:** A

### Q1.C: Which editor should the feature include?

Only if you picked C in Q1. The discovery tried the candidates on this repository's own files. More
in [discovery](discovery-01.md#the-split).

Why it matters: a live preview parses markdown in the browser, which the stack decision forbids
unless it is changed. A source editor keeps your file byte for byte.

- **A (recommended). A source editor with Vim keys, built on CodeMirror 6.**
  - [pro] your markdown is never rewritten, and your Vim keys work.
  - [con] a dependency with its own styles. Its highlighting parses markdown in the browser, which
    needs a ruling on the stack decision.
  - Why recommended: it keeps the file as written, which the WYSIWYG editors could not do.
- **B. A live-preview editor that shows headings and bold while you type.**
  - [pro] the closest to a "bit WYSIWYG" editor, with the file kept as written.
  - [con] the most work, and it needs an exception to the stack decision, or decorations that come
    from the core.

**Answer:**

## Q2: Which visual direction should the UI take?

Five directions are built over the same views and data. Open the comparison page
(`mockups/compare.html`, deleted) and try each one at a half screen: that is where your current UI
breaks. The contrast of every text colour was measured, and the secondary text was corrected where
it fell under 4.5:1. More in [discovery](discovery-01.md#the-visual-direction).

| Direction                                     | In one line                                                                     | Shell                             | Home                           |
| --------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------- | ------------------------------ |
| Natural (`mockups/natural.html`, deleted)     | Washi paper, moss and bark, serif reading, light and night                      | A floating dock, no sidebar       | A bonsai, one branch a feature |
| Cyber (`mockups/cyber.html`, deleted)         | Your own violet-black and neon green, chamfered HUD panels, parallax and glitch | A left rail, and a bottom dock    | A git-style branch map         |
| Terminal (`mockups/terminal.html`, deleted)   | LazyVim in the browser: bordered panes, a tab line, a status line               | A tab line on top, a status line  | A keyed start menu, pixel art  |
| Glass (`mockups/glass.html`, deleted)         | Liquid Glass chrome around opaque reading sheets, light and dark                | A floating glass sidebar          | Widgets and progress rings     |
| Blueprint (`mockups/blueprint.html`, deleted) | Technical drawing sheets: a title block, numbered callouts, revision clouds     | A drawing list, and a title block | A process plan with gates      |

The home and the questions page of each direction, at 1440 px:

**Natural**

Natural home (`mockups/screenshots/natural-home.jpg`, deleted) Natural questions
(`mockups/screenshots/natural-questions.jpg`, deleted)

**Cyber**

Cyber home (`mockups/screenshots/cyber-home.jpg`, deleted) Cyber questions
(`mockups/screenshots/cyber-questions.jpg`, deleted)

**Terminal**

Terminal home (`mockups/screenshots/terminal-home.jpg`, deleted) Terminal questions
(`mockups/screenshots/terminal-questions.jpg`, deleted)

**Glass**

Glass home (`mockups/screenshots/glass-home.jpg`, deleted) Glass questions
(`mockups/screenshots/glass-questions.jpg`, deleted)

**Blueprint**

Blueprint home (`mockups/screenshots/blueprint-home.jpg`, deleted) Blueprint questions
(`mockups/screenshots/blueprint-questions.jpg`, deleted)

Why it matters: this fixes the look every page takes for v1.0.0, and the layout that comes with it.
Changing it later means redoing every view.

- **A (recommended). Natural.**
  - [pro] the name comes from bonsai, and the home is the only one whose shape shows status: a
    branch waiting for you has blossoms. No sidebar means content gets the full width at half
    screen. The serif column reads best of the five.
  - [con] the tree and textures are custom art, so they cost more than a recolouring. It leads with
    a light theme, though the app today leans dark.
  - Why recommended: it meets the proposal's three hardest asks: a memorable home, a shell that
    steps aside, and comfortable reading. It has the least risk to readability.
- **B. Cyber.**
  - [pro] it is the look you usually go for, and the most memorable. The bottom dock keeps running
    work visible everywhere.
  - [con] your own sites are calmer than this one: the chamfers, hazard stripes, and parallax are
    new, and long reading under them needs restraint. Its effects need a "reduce effects" switch.
- **C. Terminal.**
  - [pro] the cheapest to build, since it is mostly text and borders. It matches the keyboard
    navigation you plan.
  - [con] the New page distinguishes its three options least. Long prose needs a proportional font
    inside the frame. The keys would be drawn but not built (see the settled points).
- **D. Glass.**
  - [pro] the most finished-product feel, and the best half-screen shell: the sidebar folds to an
    icon column. Glass sits only on navigation, so reading stays opaque.
  - [con] refraction renders in Chromium only, so the look is blur and tint. Safari has no setting
    to reduce transparency, so the app needs its own. It may read as an Apple imitation.
- **E. Blueprint.**
  - [pro] it suits long documents best: numbered callouts for questions, revision clouds on changed
    decisions, a framed "Detail A" for live previews.
  - [con] the most niche. It is also the heaviest to build, with its grid and title block.

You can answer with a mix, like "A, with E's revision clouds". Q3 asks which parts to mix.

**Answer:** C: It will be Terminal with some inspirations from Cyber.

The mockup is nice but ofc there will be massive changes. First being text size: compared to the
mockup, a 120% scale felt much more readable.

## Q3: Should any part come from a direction other than your pick?

The directions were drawn so that each part fits its own whole. But some parts stand alone. The
revision clouds on changed decisions suit any look, and so does the bottom sheet for the session.
More in [discovery](discovery-01.md#mixing-directions).

Why it matters: each part taken from another direction is a second design to translate into the
chosen colours and type. The decisions page and the spec are where you said the human reads most
carefully, so their treatment weighs most.

These options combine: B, C, and D can go together.

- **A (recommended). None: take the picked direction whole.**
  - [pro] the parts were drawn together, so spacing, type, and colour already agree.
  - [con] you give up a part you like in another direction.
  - Why recommended: it is the cheapest to build, and you can still ask for one part by name.
- **B. The shell from another direction.** Say which.
  - [pro] the shell frames every page, so it is the part to get exactly right for half screen.
  - [con] the shell sets the page's widths, so it changes the other parts' layouts too.
- **C. The home's centrepiece from another direction.** Say which: the bonsai, the branch map, the
  keyed menu, the rings, or the process plan.
  - [pro] the home is the one page meant to be unique, and it stands apart from the rest.
  - [con] a centrepiece needs the picked colours and type, so it is drawn again.
- **D. The reading treatment of questions and the spec from another direction.**
  - [pro] these are the pages you read most, and the blueprint's revision clouds and numbered
    callouts were made for them.
  - [con] these pages share their parts with every other document, so a mixed treatment can make the
    rest of the UI look odd beside them.

**Answer:** A: Regarding the home though: remove the shitty pseudo-pixel art. Let's focus only on
pure content for the moment.

We'll likely re-add a timeline-like view inspired from the blueprint mockup, but I'm not sure.

## Q4: Where should the session open on the questions page?

You want to ask the agent about the question in front of you, from that page, and read the answer
without a cramped panel. Today the session is a side panel. The mockups show three ways. Natural and
glass use a bottom sheet with three heights. Cyber and blueprint use a panel from the right.
Terminal uses a split below the page. Astryx already ships a bottom sheet with snap points and a
resizable panel. More in [discovery](discovery-01.md#the-session-beside-a-document).

Example: you are on a question about the next occurrence of a repeating task. You ask, "Why does
option C cost more?", and want the answer beside the question you are weighing.

Why it matters: it decides how much of the question stays visible while you read the answer. At half
screen a right panel leaves little width for the question.

- **A (recommended). A resizable panel on the right at wide widths, and a bottom sheet with three
  heights at medium and narrow widths.**
  - [pro] at full width you see the question and the answer side by side. At half screen the sheet
    keeps the question above it, and it goes opaque when expanded.
  - [con] two layouts to build and test, though both exist as Astryx components.
  - Why recommended: it keeps the question visible at every width, which you asked for.
- **B. Always a bottom sheet, with a peek, a half, and a full height.**
  - [pro] one layout at every width, and the answer can take the whole screen when you need it.
  - [con] on a wide screen the question sits half hidden above the sheet.
- **C. Always a floating panel from the right, over the page.**
  - [pro] the questions keep their width, and the panel can be dismissed at once.
  - [con] it covers the right edge of the page, and on a phone it fills the screen.
- **D. A separate page for the session.**
  - [pro] the simplest, and the session gets the whole width.
  - [con] you leave the question to read the answer, which is what you want to avoid.

**Answer:** A: I like the idea of that but during questions the right column will be navigation. So
session would take its place/overlay it?

Or we could have some sort of tabs on the right sidebar. I think that makes more sense, and is how
it's down in nvim with edgy: https://github.com/folke/edgy.nvim. I need to see mockups.

## Q5: Should the UI get a third width class for half screens?

The [layout decision](/specs/decisions/ui-layout.md) fixes two width classes, switching at 768 px,
and says views adapt "through the theme and never per-view media queries". Half of a 1920 px screen
is 960 px. The desktop layout there puts the sidebar, the page, and a 320 px aside side by side. The
tests only run at 402 and 1440 px. Material 3 calls 840 to 1199 px its "expanded" class, where a
rail replaces the drawer. More in [discovery](discovery-01.md#width-classes).

Why it matters: this is the fix for the layout that breaks at half a screen's width. It amends an
active decision, and every view's tests follow the classes you pick.

- **A (recommended). Add a middle class from about 840 to 1199 px, where the sidebar folds to icons
  and an aside opens as an overlay.**
  - [pro] it fixes half screen directly, and the mockups were built and checked at that width.
  - [con] a third layout per view, and the tests must run at about 960 px as well.
  - Why recommended: half screen is how you use the app, so it should be a class, not a patch.
- **B. Keep two classes and move the switch up to about 1024 px.**
  - [pro] no new layout to build.
  - [con] at 960 px you get the phone layout on a wide window, which wastes the screen.
- **C. Keep two classes, and let each pane adapt by its own width with container queries.**
  - [pro] panes adapt wherever they sit, with no class to test.
  - [con] it needs a ruling on the decision's "never per-view" rule, and each pane is tested alone.

**Answer:** A: Might need a bit of a bigger delta though, my half screen (27" 4k with 1.5x scaling)
is 1205 pixels.

## Q6: Should prototypes like these be part of the workflow?

The proposal says this feature decides it. The skill today says that with an active preview
decision, mockups are Storybook stories. The [preview decision](/specs/decisions/preview.md) says
mockups MUST be stories written with the real components. You asked for these to be HTML, so they
are: the workflow's rules and this round differ. Five directions as stories would have meant
rebuilding five complete UIs in Astryx. More in
[discovery](discovery-01.md#prototypes-in-the-workflow).

Why it matters: it changes the skill and an active decision. Without an answer, the next feature
that wants to compare looks would face the same conflict.

- **A (recommended). Allow throwaway prototypes in any format in an investigation, under the
  feature's `mockups/` folder, and delete them when the spec is approved.**
  - [pro] the agent can explore freely and cheaply. The spec still gets its mockups as stories, for
    UI that ships. Git keeps the deleted files.
  - [con] the preview decision must be narrowed, and the skill's discovery and spec steps edited.
    The lint ignore for `mockups` folders, added with this round, stays.
  - Why recommended: an investigation compares ideas, and real components make that slow.
- **B. Keep Storybook only, even for investigations.**
  - [pro] the rule stays as it is, and the mockups are the real components.
  - [con] a comparison of several looks becomes too costly, so the agent would show one. The lint
    ignore for `mockups` folders, added with this round, comes out.
- **C. Allow throwaway prototypes, and keep the picked one in the repository as the spec's mockup.**
  - [pro] the spec's mockup is the investigation's own file, clickable and exact.
  - [con] a prototype is not the real component, so it drifts from what gets built.

**Answer:** A

## Q7: Which colour modes must the UI support?

The current UI has a light and a dark theme. Natural, glass, and blueprint show two modes each.
Cyber and terminal are dark only. More in [discovery](discovery-01.md#colour-modes).

Why it matters: every mode doubles the palette to keep readable at the contrast floor, and every
screenshot test.

- **A (recommended). Both light and dark, following the system, with a manual switch.**
  - [pro] you can read in daylight, and nothing is lost from today.
  - [con] two palettes to measure and keep at 4.5:1.
  - Why recommended: it matches today, and dropping a mode is harder to reverse than keeping both.
- **B. Dark only.**
  - [pro] half the palette work, and the dark directions need no light version.
  - [con] long reading in daylight is harder, and today's light theme goes away.
- **C. Light only.**
  - [pro] the simplest, and it favours the natural and vellum looks.
  - [con] you lose the dark look at night, and cyber and terminal cannot be picked.

**Answer:** A: Use Catpuccin Mocha and Latte. We'll also add more color schemes later.

## Q8: How should priorities be laid out?

Priorities has four groups, Ongoing, Now, Next, and Later, and the order inside each group matters.
You wanted the hierarchy and the status clear, and mentioned vertical panes that scroll sideways as
an idea. The mockups show both: four columns (natural, cyber, terminal) and one vertical list
(glass, blueprint). More in [discovery](discovery-01.md#priorities-layout).

Example: Ongoing has 2 lines, Next has 6, and you drag "Keyboard navigation" above "Run options".

Why it matters: this page is where you decide what to work on, so reading and reordering are both
the main tasks.

- **A (recommended). One vertical list in four groups, where the heading weight and the rank show
  the hierarchy.**
  - [pro] it reads top to bottom, works at half screen, and keeps the order visible. It can have
    "Move to top" menu actions beside dragging.
  - [con] you see one group's items at a time on a short screen.
  - Why recommended: order is the thing that matters, and a list shows order best at any width.
- **B. Four columns side by side, scrolling sideways.**
  - [pro] you see every group at once on a wide screen, as in your idea.
  - [con] at 960 px only two columns fit, and sideways scrolling hides the order.
- **C. Columns on wide screens, and a vertical list below.**
  - [pro] the best of both at each width.
  - [con] two layouts to build, test, and keep in step.

**Answer:** C: Columns on wide screens just looks so much better, kanban style.

Half-wide should also be columns, with a vertical sidebar on the left for navigation.

## Q9: May the redesign add dependencies and bundled fonts?

The directions use serif and mono fonts (Fraunces, Newsreader, Inter, JetBrains Mono, IBM Plex). All
are open-licence fonts under the SIL OFL, the mockups load them from Google Fonts for convenience.
The Uraeda server listens only on the loopback interface and often runs offline. Astryx already
ships a bottom sheet, a resizable panel, a command palette, and a lightbox. More in
[discovery](discovery-01.md#dependencies-and-fonts).

Why it matters: a new dependency is a decision. A font loaded from a CDN sends a request off the
machine each time the UI opens.

- **A (recommended). Bundle up to three open-licence font families with the app, and add no new UI
  library.**
  - [pro] it works offline, makes no outside request, and Astryx's own components cover the panels.
  - [con] the fonts add to the download, and Astryx's sheet and panel may need small gaps filled.
  - Why recommended: it adds no dependency and keeps the server's loopback-only promise.
- **B. As A, and add a panel library such as react-resizable-panels.**
  - [pro] richer panels, with sizes remembered.
  - [con] a second panel system next to Astryx's, and a dependency to pin.
- **C. Load the fonts from a font CDN.**
  - [pro] the least work, and what the mockups do.
  - [con] a request leaves the machine at every load, and the UI looks different offline.

**Answer:** A: Regarding the panels, it's up to you. If the dependency makes code much easier, it
might be worth it.

## Q10: Which icon set should the UI use?

You asked for many more icons: the sidebar, the agents' statuses, a feature's step, a spec's parts,
and the inbox and priorities. The app copies 53 Lucide icons today. The mockups use 49 icons drawn
for them, which are not a real set. More in [discovery](discovery-01.md#icon-set).

Why it matters: icons carry the status of every row, so their style sets the UI's tone as much as
the colours do.

- **A (recommended). Lucide, extended.** It has about 2,200 icons under the ISC licence, and the app
  already uses it.
  - [pro] no migration, one stroke style that each direction can restyle by stroke width.
  - [con] the style is neutral, so it adds no personality.
  - Why recommended: it has every icon needed, and one family keeps the UI coherent.
- **B. Phosphor.** It has about 1,500 icons in six weights.
  - [pro] a weight per direction, including a duotone that suits the natural look.
  - [con] a migration of every icon, and fewer icons than Lucide.
- **C. A custom set drawn for the chosen direction.**
  - [pro] the most distinctive, and it can carry the direction's shapes.
  - [con] the most work, and a set to maintain as the app grows.

**Answer:** A: Without a clear comparison and only 2 options it's hard to really pick. I'd like to
be shown more options and see them visually.

## Q11: Which logo concept should the UI use?

The UI has no logo and no favicon. The name comes from 裏枝 (ura-eda), the back branch of a bonsai,
which grows behind the trunk and gives the tree its depth. Five concepts (`mockups/logos.html`,
deleted) are drawn, each in one colour and shown at 96, 32, and 16 px. The final mark is refined in
the spec. More in [discovery](discovery-01.md#logo).

Why it matters: the logo appears in the tab, the sidebar, and the README, and is hard to change once
people recognise it.

- **A (recommended). The back-branch mon: a circle with a trunk, and one branch behind it showing
  only its tip.**
  - [pro] it tells the name's story and reads as a crest. It stays a recognisable circle at 16 px.
  - [con] the hidden branch is subtle, so it needs the story told once.
  - Why recommended: it is the only concept that draws what the name means.
- **B. An open ensō with a bud in the gap.**
  - [pro] simple and calm.
  - [con] at 16 px it looks like a reload icon.
- **C. A git fork drawn as a bonsai.**
  - [pro] it shows the git-driven part.
  - [con] it reads as a cactus at a glance.
- **D. A vermilion seal with the two characters.**
  - [pro] it is the most legible at 16 px, and can double as the "approved" stamp on specs.
  - [con] it needs the kanji, which most readers cannot read.
- **E. A dot-matrix tree.**
  - [pro] it is crisp, and fits the terminal look.
  - [con] it suits one direction only.

**Answer:** E

## Q12: How should the harnesses be marked?

You asked for icons for the harnesses: Claude Code, Codex, Pi, and others. The research found
limits. Anthropic's trademark guidelines need prior approval for the Claude Code mark and forbid
changing it, which includes recolouring. Gemini CLI's brand page says it was replaced by another
product for some users. A set of the official marks exists in `lobe-icons`, but it is not a licence
to use them. More in [discovery](discovery-01.md#harness-marks).

Why it matters: it is a legal choice you own, and a recognisable mark helps you tell sessions apart
at a glance.

- **A (recommended). Draw one neutral glyph per harness, next to its name.**
  - [pro] no trademark question, and a colour per direction is allowed.
  - [con] the glyphs are not the logos, so they are less instantly recognisable.
  - Why recommended: it gives the glance value without a licensing question you would have to
    settle.
- **B. Use the official marks.**
  - [pro] instantly recognisable.
  - [con] some need approval, none may be recoloured, and they may clash with the chosen look.
- **C. Use the harness name only, with no mark.**
  - [pro] nothing to draw or license.
  - [con] a list of sessions is slower to scan by text alone.

**Answer:** A: I see some already are in nerd fonts: \uec82 for claude code for example

## Settled without the human

### Check these

- **The lint ignore for mockups folders** is a change to the repository's checks, outside this
  feature's folder. It lets throwaway scripts in `specs/**/mockups/**` skip the app's lint, which
  they cannot pass. The constitution asks a human to approve a loosened check, so this is yours to
  accept. Q6 decides whether it stays.
- **Keyboard keys in the terminal look** are drawn and not built. If you pick that direction, its
  keys (`j` and `k`, a leader key, key hints) stay out, since keyboard navigation is its own item in
  the [priorities](/specs/PRIORITIES.md). The layout still takes the look.
- **The questions page stays one scroll**, with a sticky question heading and an outline, not one
  question per screen. The evidence for one question at a time is mixed, and later questions refer
  back to earlier ones. You also asked to always see the question while answering. See
  [discovery](discovery-01.md#needs-no-choice).
- **Text contrast** is held at 4.5:1 for text, and 3:1 for large text and controls. Several of the
  agent's own first colours missed it, so the secondary text in every mockup was corrected after
  measuring. Decorative marks, like the dim grid lines, are not text.

### Behaviour

- **The shell shows the same things at every width.** The inbox draft, New, running sessions,
  features in progress, the 5 h limit, and the settings stay one tap away. At half screen the shell
  folds to icons and counts, and it never hides them.
- **A "reduce effects" setting** turns off glass blur, parallax, glitch, and textures, alongside the
  system's reduced-motion setting. Safari does not support the reduced-transparency setting.
- **The New page** shows its three choices as three differently shaped cards, in the picked
  direction's art. The flow behind them belongs to the merge-chats feature.
- **The feature colour** is already removed by merge-chats, so nothing is left to remove here. The
  Storybook link on a feature's page is removed, as you asked.
- **The inbox** stays a categorised list you can reorder, with categories you can create and delete.
  Its notes show whole, and a note's actions sit beside it.
- **Decisions come first in a spec**, with their changes marked. A live preview is always framed and
  labelled, so it cannot be mistaken for the document.
- **Priorities and the inbox** get menu actions to move a line, beside dragging.

### Under the hood

- **Tokens** go through Astryx's theme levers where they exist. What they cannot hold, like a
  texture or a tree drawing, is listed in the plan's complexity tracking.
- **The prototypes** stay in this feature's `mockups/` folder until the spec, where Q6's answer
  decides their fate.
- **The mockups' fake data** comes from this repository's own files, so they can be checked against
  the real UI.

**Notes:** Btw with the terminal look is Astryx still a good fit? Do we need another components
system?

- **Keyboard keys in the terminal look**: Yes, this is a feature after the text editor. All the
  features are in "Now", pre 1.0
- **A "reduce effects" setting**: I think it's pretty pointless
