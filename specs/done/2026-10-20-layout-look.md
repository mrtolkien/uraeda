---
kind: feature
finished: 2026-10-24
pull-request: https://github.com/mrtolkien/uraeda/pull/55
---

# Record: Layout and look and feel

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-20, finished on
> 2026-10-24, in [its pull request](https://github.com/mrtolkien/uraeda/pull/55). Its full files are
> in git: `git log -- specs/2026-10-20-layout-look/`.

## What and why

The UI worked, but looked vanilla and unfinished before v1.0.0, and its layout, grown view by view,
broke at half a screen's width, where the human often works. The human asked for one design pass:
they set what each view shows, the agent built several throwaway directions to pick from, and the
spec wrote the picked one down. The human picked a terminal look, LazyVim-like, with a touch of
their own cyber style. The pass was split in three: this feature sets the identity, the shell, and
three width classes, and redraws the home, settings, and decisions pages. The questions and spec
pages, then the lists and starts, follow as their own features.

## Behaviour

- **The terminal look (US1).** Every page draws JetBrains Mono by default, and Inter for reading
  prose, the human's "readability first". Colours are Catppuccin: Mocha and Latte.
  - Text is 120% of Astryx's base size at every width, the phone included: body text is 16.8 px.
  - Corners are square, and shadows none; dots, radios, and avatars stay round.
  - Every text colour, disabled text included, reaches 4.5:1 on each background it is drawn on, and
    every border and control 3:1, in both schemes. A test of the built theme's tokens checks it.
  - Settings' Appearance picks Mocha, Latte, or System, kept in the browser under `uraeda.theme`.
    System follows the system's light or dark setting. A stored `"dark"` reads as Mocha, `"light"`
    as Latte.
  - Fonts are bundled with the app; the built app loads nothing from another host, checked offline.
  - The logo and the favicon are the dot-matrix tree.
  - A harness is marked beside its name: Codicons' Claude mark for Claude Code, its OpenAI mark for
    Codex, a π drawn for Uraeda for Pi. The fake agent and any unknown kind get a generic bot glyph.
    The mark is silent where its name is already said.
  - Icons come from Lucide; another free set's glyph may stand in where it fits clearly better.
- **A shell for three widths (US2).** The classes are narrow under 768 px, semi-wide to 1279 px, and
  wide from 1280 px. Crossing 1280 px changes the shell only: the page keeps its place.
  - Wide: a column of bordered panes. New, as the primary button, and Note lead it, then the session
    search, Navigate, Needs you, Sessions, In progress, and Done. The 5 h window and Settings sit at
    its foot.
  - Sessions holds the sessions without a workflow, each with its harness mark; In progress the
    features and changes in flight, oldest started first. A feature's session stays on its card.
  - A card's whole name shows, wrapping, with its step on a second line; nothing is cut.
  - The column takes 14% of the window, from 256 to 340 px, until dragged. A drag stops at 220 and
    480 px and never folds. `[` and the fold button fold it to a rail of icons in the page's flow.
    Width and fold are kept under `uraeda.nav`; Astryx's old key is read once, then removed.
  - Semi-wide: a 52 px rail of icons. It opens over the page after the mouse rests on it 250 ms, on
    keyboard focus inside it, or on a tap of its logo. It folds when the mouse or focus leaves, on
    Escape, or on a tap outside.
  - Narrow: a top bar of icon tabs, each with its count as a badge, named "Sessions, 3 running". The
    Sessions tab's page, `/sessions`, holds the repository menu, ＋ Note and ＋ Priorities, the
    search, the panes, and the 5 h window: what the old drawer held.
  - A status line sits fixed at the window's bottom at every width. It shows the keys the page
    declares, then "N need you" and "N running". Its counts wrap rather than be cut.
  - It names only keys that work today: `j k` in lists, `/` on the decisions page, `[ fold` on wide
    screens, and Escape only where a pane is open to close. The phone shows no hints.
  - On the phone the status line also holds the page's slot, a round's count and Next. It is hidden
    while a sheet that leaves the page usable is open. Nothing hides under it.
  - A jump to a section, a principle, or any anchored heading lands below the phone's tabs, with a
    pane's title whole.
- **A home of core and overview (US3).** The home is centred. The core comes first: Problems when
  any stop the workflow, then Needs you, then In progress beside Sessions.
  - Problems lists only what stops the workflow, never notes, each with its first message and "Fix".
  - Every row shows the item's whole title, a second line, and at its end the action a gate asks
    ("Answer", "Review", "Write", "Fix") or the session's status.
  - Needs you's second line is the gate's short name, "Questions", then the round's size.
  - A level-2 heading, "Overview", between dashed rules, opens the widgets. From semi-wide they sit
    in two columns, by rows; on the phone every pane is one column, in the same order.
  - Priorities now: the first five of Ongoing and Now. Usage: the agent, the 5 h window and the week
    in "N% used" with their resets and bars, no week without a report, and "No run reported usage
    yet." before any.
  - Inbox: the three latest notes, then "10 notes to organize". Recent: the latest five done items,
    then "Show all".
  - Home no longer shows Next, the count tiles, or the decisions' card: the shell holds them.
- **Decisions in three columns (US4).** The shell, the list, and the reader. The list is the active
  pane, 30% of the window and never under 320 px.
  - The list holds the constitution's principles, then the decisions in today's order and sort, each
    with its icon, its first sentence, and its count of rules.
  - The reader is always open on wide and semi-wide screens. `/decisions` shows the constitution,
    the list marking principle I; a principle opens the whole constitution at it.
  - The reader has Previous and Next, and no Close; Escape returns to `/decisions`. On the phone the
    reader replaces the list, with a way back.
  - A decision changed on any feature's branch in flight shows that change as a diff, "Proposed by
    <feature>, on its branch", before the decision.
  - `/` or "Jump to…" opens a palette over every entry, the first result under the cursor after each
    letter, the entry under the cursor previewed beside it. On the phone it is a bottom sheet with
    no preview. Back closes it.
  - `/` does nothing in a text field, a dialog, a menu, or an open popup. An empty search reads
    "Nothing matches.". Every entry of the repository's ledger is the first result of some query of
    three letters or fewer.
- **Settings on one page (US5).** One form of six bordered sections: Server, Appearance, Sign-in,
  Agents, Runs, and Reviews. There is no file view.
  - Each row has an icon, its name as a heading, a line of help, and its control, under the text on
    the phone. Settings to come are rows with "Comes with <feature>." and no control.
  - A search, at the end of the heading row on wide screens and under it on the phone, filters rows
    by name, help, terms, or section. No match reads "No setting matches “zzz”.".
  - `/settings/<category>` draws the form scrolled to that section, unless Back or a reload restores
    a place. An unreadable `settings.toml` shows its problem in Server and Runs.
  - A row's refusal stays while a search hides and shows the row again.
- **Prototypes in an investigation (US6).** A discovery may compare throwaway prototypes in any
  format, in the feature's `mockups/` folder.
  - The approval step deletes those the spec does not link, and the plan step deletes any left,
    whatever approved the spec.
  - Every link to a deleted prototype, in any file of the feature, becomes its text and its path in
    code, so `ura check` passes.
  - A spec's mockups stay stories with the real components; a layout mockup may still be HTML,
    linked from its story.
- **The server.** A session row carries its agent's kind, and a usage report carries the 5 h window,
  the week, or both. Each process keeps each window's freshest report, so a 5 h report alone keeps
  the week. The benchmarks' runner counts a full week as the usage limit too.

## Design

The look is one Astryx theme, upgraded to Astryx 0.7.3 first, and the layout three width classes
read from one hook. Four parts Astryx lacks are small components of ours: the titled pane, the
shell's column and rail, the status line, and the palette's preview. Pages never read breakpoints or
colours themselves.

- **The theme**, [`theme/theme.ts`](/packages/web/src/theme/theme.ts): Catppuccin roles on Astryx's
  neutral token names, Latte in the light slot and Mocha in the dark one, the fonts, square radii,
  and the 120% sizes as exact tokens. Its contrast test is
  [`theme-tokens.test.ts`](/packages/web/src/__tests__/theme-tokens.test.ts). The scheme preference
  is [`theme.tsx`](/packages/web/src/theme.tsx); reading prose takes Inter in
  [`Prose.tsx`](/packages/web/src/Prose.tsx).
- **The width classes**, [`useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts): `narrow`,
  `semi`, or `wide`, the one place a view learns its width. Browser tests run at `"semi"` through
  `atSize` in [`helpers.tsx`](/packages/web/src/__browser__/helpers.tsx), and stories through
  [`.storybook/widthClass.ts`](/packages/web/.storybook/widthClass.ts).
- **The pane**, [`layout/Pane.tsx`](/packages/web/src/layout/Pane.tsx): a border with its title in
  it, lavender, the accent while active, peach or red for attention or a problem. Every bordered
  group of the four views uses it. Where a jump lands is
  [`layout/scrollMargin.ts`](/packages/web/src/layout/scrollMargin.ts).
- **The shell**, [`Shell.tsx`](/packages/web/src/Shell.tsx) and
  [`shell/`](/packages/web/src/shell/): [`Column.tsx`](/packages/web/src/shell/Column.tsx) with its
  stored width in [`columnWidth.ts`](/packages/web/src/shell/columnWidth.ts),
  [`Rail.tsx`](/packages/web/src/shell/Rail.tsx), [`Tabs.tsx`](/packages/web/src/shell/Tabs.tsx),
  [`ShellPanes.tsx`](/packages/web/src/shell/ShellPanes.tsx), and
  [`SessionsPage.tsx`](/packages/web/src/shell/SessionsPage.tsx). A card's row is
  [`sidebar/CardRow.tsx`](/packages/web/src/sidebar/CardRow.tsx). The route table moved to
  [`routeTable.ts`](/packages/web/src/routeTable.ts), out of an import cycle.
- **The status line**, [`shell/StatusLine.tsx`](/packages/web/src/shell/StatusLine.tsx), draws the
  hints pages declare in [`statusHints.tsx`](/packages/web/src/statusHints.tsx).
- **The home**, [`home/`](/packages/web/src/home/HomeHub.tsx): the core in
  [`Core.tsx`](/packages/web/src/home/Core.tsx), the rows and the "Overview" line in
  [`parts.tsx`](/packages/web/src/home/parts.tsx), and the widgets in
  [`HomeHub.tsx`](/packages/web/src/home/HomeHub.tsx),
  [`Usage.tsx`](/packages/web/src/home/Usage.tsx), and
  [`Recent.tsx`](/packages/web/src/home/Recent.tsx).
- **Settings**, [`settings/`](/packages/web/src/settings/SettingsView.tsx): the form in
  [`SettingsView.tsx`](/packages/web/src/settings/SettingsView.tsx), a row in
  [`SettingRow.tsx`](/packages/web/src/settings/SettingRow.tsx), and each row's icon, help, and
  search terms in [`categories.ts`](/packages/web/src/settings/categories.ts).
- **Decisions**, [`decisions/`](/packages/web/src/decisions/DecisionsPage.tsx): the page in
  [`DecisionsPage.tsx`](/packages/web/src/decisions/DecisionsPage.tsx), the reader in
  [`ConstitutionReader.tsx`](/packages/web/src/decisions/ConstitutionReader.tsx) and
  [`DecisionDetail.tsx`](/packages/web/src/decisions/DecisionDetail.tsx), a branch's change in
  [`BranchChange.tsx`](/packages/web/src/decisions/BranchChange.tsx), and the palette in
  [`JumpPalette.tsx`](/packages/web/src/decisions/JumpPalette.tsx) with its ranking in
  [`jump.ts`](/packages/web/src/decisions/jump.ts). The palette is Astryx's `CommandPalette`, inline
  in a dialog, reading the cursor from its public context.
- **The marks**: [`HarnessMark.tsx`](/packages/web/src/HarnessMark.tsx), the logo in
  [`Logo.tsx`](/packages/web/src/Logo.tsx) and [`favicon.svg`](/packages/web/public/favicon.svg),
  and the icon registry in [`theme/icons.ts`](/packages/web/src/theme/icons.ts), with Lucide's
  glyphs in [`theme/lucide.ts`](/packages/web/src/theme/lucide.ts).
- **The server**: the week's usage in
  [`claude-events.ts`](/packages/server/src/runner/claude-events.ts) and
  [`processes.ts`](/packages/server/src/runner/processes.ts), and a session row's agent kind in
  [`fate/views.ts`](/packages/server/src/fate/views.ts).
- **The skill's prototypes**: [discovery](/skills/uraeda/references/discovery.md#prototypes) allows
  them, and [approval](/skills/uraeda/references/approval.md#delete-the-prototypes) deletes them and
  rewrites their links.
- **Dev builds** key StyleX's styles as the build does, `debug: false` in
  [`vite.transforms.ts`](/packages/web/vite.transforms.ts), so our overrides of Astryx's styles win
  in Storybook's dev server too.

## Questions

### Round 01

#### Q1: How should this work be split into features?

**Answer:** A: three features in order, this one first (identity, shell, width classes, home,
settings, decisions), then the reading pages, then the lists and starts; the markdown editor later,
as its own feature.

#### Q2: Which visual direction should the UI take?

**Answer:** C: "Terminal with some inspirations from Cyber", with text at 120% of the mockup's size,
which "felt much more readable".

#### Q3: Should any part come from a direction other than your pick?

**Answer:** A: the picked direction whole, but the home without "the shitty pseudo-pixel art", "pure
content for the moment"; a timeline inspired by the blueprint mockup may come back later.

#### Q4: Where should the session open on the questions page?

**Answer:** A, with a doubt: the right column is navigation during questions, so the session may be
a tab of the right sidebar, as folke's edgy.nvim does it. "I need to see mockups": left to the
questions page's feature.

#### Q5: Should the UI get a third width class for half screens?

**Answer:** A: a middle class, with a bigger range, since the human's half screen on a 27" 4K at
1.5× scaling is 1205 px wide.

#### Q6: Should prototypes like these be part of the workflow?

**Answer:** A: throwaway prototypes in any format, in the feature's `mockups/` folder, deleted when
the spec is approved.

#### Q7: Which colour modes must the UI support?

**Answer:** A: light and dark, following the system with a manual switch, as Catppuccin Latte and
Mocha; more schemes later.

#### Q8: How should priorities be laid out?

**Answer:** C: kanban columns on wide screens, which "just looks so much better", and at half screen
too, beside a navigation sidebar; a vertical list below. Left to the lists' feature.

#### Q9: May the redesign add dependencies and bundled fonts?

**Answer:** A: bundled open-licence fonts; a panel library is the agent's call, if it makes the code
much easier. None was added.

#### Q10: Which icon set should the UI use?

**Answer:** A, provisionally: "I'd like to be shown more options and see them visually", asked again
in round 02.

#### Q11: Which logo concept should the UI use?

**Answer:** E: a dot-matrix tree.

#### Q12: How should the harnesses be marked?

**Answer:** A, with a note that Nerd Fonts already carries a Claude Code glyph; asked again in
round 02.

#### Notes

- The human asked whether Astryx still fits the terminal look, or another component system is
  needed; round 02 kept Astryx, re-themed.
- **Keyboard keys in the terminal look**: keyboard navigation is a feature after the text editor,
  all in "Now", before 1.0.
- **A "reduce effects" setting**: "pretty pointless", so none was built.

### Round 02

#### Q1: Which icon set should the UI use?

**Answer:** A: Lucide, as today, written down so that another set's icon may be mixed in where it
fits particularly better or has a very specific glyph.

#### Q2: How should a session show which harness runs it?

**Answer:** B: Codicons' marks for Claude Code and Codex, as in Nerd Fonts, used without their
owners' approval, and neutral glyphs for the others.

## Decisions

- [UI look](../decisions/ui-look.md), new: a terminal look in one theme, with readability first, a
  monospace font and a proportional one for prose, Catppuccin schemes, 120% text, contrast floors,
  bundled fonts, Codicons' harness marks, and Lucide icons.
- [UI layout](../decisions/ui-layout.md), changed: three width classes, narrow, semi-wide, and wide,
  instead of two.
- [Preview](../decisions/preview.md), changed: an investigation may compare throwaway prototypes in
  any format, deleted at its spec's approval; a spec's mockups stay stories.

## Changes after approval

- From the approval's comments: the UI look decision lost its rules on the colour schemes and on the
  logo, and its Lucide rule became a SHOULD. Settings is the form only, with no file view of
  `settings.toml` and no picker in it.
- After approving, the human asked that fonts need not be monospaced everywhere, readability first:
  the UI look decision allows a proportional font where it reads better, and prose is set in Inter.
- The spec's mockups were the HTML prototypes at approval, as the human asked. Stories with the real
  components replaced them once built, and the prototypes were then deleted.
- The upgrade kept Astryx 0.7's wrapping of long lines in a message's code block, rather than
  scrolling sideways, and documents' lists sit flush with their column.
- Borders reach 3:1 with no exception, a pane's as a control's, so panes' lines are stronger than
  the mockup's. The priorities' "Later" edge is as strong as "Next"'s, and dimmed by its heading.
- What the wider text moved: a verdict button reads "Request changes, start the agent", and the
  reading measure is 86 characters' width of Inter. The spec page's inset on the phone is 14.4 px,
  12 px at 120%.
- The usage report carries the week, which a test once checked was ignored; the home's Usage pane
  shows it.
- On the phone, the Sessions tab's page holds the repository menu and the ＋ forms the drawer held.
- Cards show their whole name, wrapping, with their step under it, instead of a name cut by an
  ellipsis.
- The rail opens after a 250 ms rest of the mouse, not at once, so a click on the way in lands on
  the icon under it.
- The status line has no mode pill. It is fixed at every width, holds the round's count and Next on
  the phone, and shows no hints there.
- The home's rows show "Review" for a spec or a plan, not the mockup's "Approve". In progress has no
  segmented step bar.
- The home no longer shows per-category inbox counts, Next, its count tiles, or the decisions' card.
  Priorities now shows the first five entries only.
- The usage widget has no "Warning at N%", which no setting backs.
- Decisions keep today's order and sort, not the mockup's areas, which no field holds. The reader
  has no Close: Escape returns to the constitution.
- A decision "changed on this branch" reads as changed on any feature's branch in flight, since the
  server reads the default branch.
- SC-005 is measured as the letters typed between `/` and Enter, three or fewer for every entry:
  `/`, a letter, and Enter alone cannot tell 31 entries apart. On the phone the palette has no
  preview.
- The deletion of prototypes rewrites links to them in every file of the feature, and the plan step
  deletes any left, whatever approved the spec.
- Catching up with main, the preview decision kept both new rules: main's HTML layout mockup, linked
  from its story, and this feature's throwaway prototypes.
- The final review's fixes: a jump leaves room for the phone's tabs and a pane's whole title, in
  every document; the lists name Escape only while a pane is open.
- "Show earlier messages" keeps the reader's place however late the messages draw, a fix of the
  session's tail found under load.

## Follow-ups

- The questions page, the spec and plan pages, and the lists and starts are drafts in Now:
  [questions page](2026-10-24-questions-page.md), [spec page](../drafts/spec-page.md), and
  [lists and starts](../drafts/lists-and-starts.md). The session beside a document and the kanban
  priorities wait there.
- The screenshot script stops at two other features' views: `text-discard` on the desktop, left in
  another state by the views before it, and `change-pull-request` on the phone, which waits for a
  "Pull request state unknown" button.
- Other features' phone screenshots now open the Sessions tab where they opened the drawer; their
  next screenshots say whether they still show their point.
- The fonts' readability, monospace against Inter, is left for the human's review in use.
- A feature branch changing more than 50 files makes the decisions' reader read its branch's
  decision for every decision opened; a ledger field would replace it if it slows.
- A home without problems has no story: Storybook serves one fixture, which holds a blocked feature.
