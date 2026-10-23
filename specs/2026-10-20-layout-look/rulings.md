# Rulings: Layout and look and feel

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: The palette's preview reads the highlight from the palette's context

- **Decision**: Task 13 keeps Astryx's `CommandPalette` and draws the preview in one of its slots,
  `footer` or `input`, from `useCommandPaletteContext()`: the item under the cursor is
  `selectableItems[highlightedIndex]`. The same slot highlights the first result when nothing is
  highlighted, through the context's `setHighlightedIndex`, so "noti" then Enter opens
  Notifications.
- **Rationale**: the plan's check failed as written: `renderItem(item, isSelected)` passes
  `item.id === value`, the picker's chosen value, never the highlight (`CommandPalette.js`, Astryx
  0.7.3), so a preview fed by it never moves. The context is public
  (`@astryxdesign/core/CommandPalette` exports `useCommandPaletteContext`) and follows ↑↓. Astryx
  clears the highlight on every keystroke and Enter then picks nothing, which the spec's "noti",
  Enter would hit. Both behaviours are checked in
  [`palette-check.test.tsx`](/packages/web/src/__browser__/palette-check.test.tsx).
- **Alternatives considered**: the plan's fallback, a palette built on `Dialog`, `TextInput`, and
  `List`: more of our own code for the keyboard, the listbox's roles, and the announcements Astryx
  already has. Reading `aria-activedescendant` from the input: the DOM, not an API.
- **If wrong**: the slots sit below or above the list, not beside it, so a preview beside the list
  needs a layout the palette does not offer; if Task 13 needs it beside, or a later Astryx changes
  the context, it moves to the fallback, contained in `JumpPalette.tsx`. The check fails first on an
  upgrade that breaks it.
- **Where**: task 1, `packages/web/src/__browser__/palette-check.test.tsx`; task 13.

## R2: The upgrade keeps Astryx 0.7's touch type, and documents' lists stay inside their column

- **Decision**: the neutral theme's new rule for touch screens under 1024 px, body text at 16 px
  rather than 14 and the scale re-derived, is kept. The two places it cut text on the phone are
  fixed: the round's "Show the 2 points" no longer shrinks beside its heading, which wraps instead
  (`SettledGroups.tsx`), and the repository's name under "Uraeda" wraps rather than be cut
  (`RepositoryMenu.tsx`). A document's list takes `edge="flush"`, not the codemod's `"outset"`.
- **Rationale**: the larger text goes the way of the UI look's "readability first" and of Task 2's
  120% at every width, which replaces these sizes anyway. `astryx upgrade` turned
  `edgeCompensation="inline"` into `edge="outset"`, which in 0.7 widens the list by the padding of
  the nearest container: a spec's lists then reached 4 px past the phone's screen. `"flush"` puts
  the rows' text on the list's edge, the heading's line, which the alignment checks pass.
- **Alternatives considered**: overriding the neutral theme's touch rule to keep 14 px until Task 2:
  a rule written only to be removed in the next wave. Keeping `"outset"` and resetting the container
  padding around each list: styles reaching into Astryx's internals.
- **If wrong**: the touch rule can be cancelled in `theme.ts`'s adaptations; a list's edge is one
  prop in `Blocks.tsx`.
- **Where**: task 1, `packages/web/src/Blocks.tsx`, `SettledGroups.tsx`, `RepositoryMenu.tsx`.
- **Superseded by task 2** for the sizes: the theme's own rule for coarse pointers, last of the
  adaptations, sets the type scale back to 16.8 px on every screen, so the neutral theme's 16 px
  touch text no longer applies (R4). The wrapping fixes stay.

## R3: A message's code block wraps its long lines, as Astryx 0.7 draws it

- **Decision**: the session look's browser test of a code block wider than the phone now checks that
  its line wraps whole inside the block and the page never scrolls sideways, instead of the block
  scrolling sideways.
- **Rationale**: Astryx 0.7's `Markdown` wraps fenced code blocks' long lines (its changelog,
  #7564), so a reader sees whole lines. The guarantee the test held, nothing past the screen's edge,
  still holds; no spec asks for sideways scrolling. Readability first, in the UI look, favours the
  wrap.
- **Alternatives considered**: a `components.code` renderer with a non-wrapping `CodeBlock`, in
  `Prose.tsx`, to keep the old scroll: our own code to undo a library's readability choice.
- **If wrong**: the renderer above restores the scroll, in one place, and the test's first version
  comes back from git.
- **Where**: task 1, `packages/web/src/__browser__/session-look.test.tsx`.

## R4: The theme's Catppuccin roles, exact 120% sizes, and what the contrast test measures

- **Decision**: Astryx's neutral token names take Catppuccin roles: body and card the base, surface
  and popover the mantle, muted Latte's mantle and Mocha's crust, every border, a pane's as a
  control's, overlay0 (Mocha) and overlay2 (Latte), 3:1 from body, surface, card, and muted, accent
  mauve, Astryx's hues the matching Catppuccin accents (orange peach, cyan sky, purple mauve), and
  their backgrounds a tint of each over the base, 12% in both schemes. Latte's accents as text are
  the mockup's darker steps, darkened by up to 5% more, so each reads 4.5:1 on its own tint too
  (blue `#1957d5`); its pink and sky, missing from the mockup, take darker steps, `#a72592` and
  `#0a688e`. Latte's grey background is its crust, lighter than surface0, so secondary text reads
  4.5:1 on it; muted is Latte's mantle and Mocha's crust, apart from grey, as a story's stage and
  its phone frame need. The type scale is written as exact `--font-size-*` tokens, Astryx's 14 px
  scale × 1.2, at the root and again in the coarse-pointer rule, which also undoes the neutral
  theme's touch text (R2). `--radius-full` stays round, so dots, radios, and avatars stay round;
  badges and switches set it to 0 inside themselves. Shadows are `none`. Reading text takes Inter by
  inheritance, never by resetting `--font-family-body`: buttons and badges, which Astryx has inherit
  their font, take the body font in the theme, so a control inside prose stays monospace.
  `theme-tokens.test.ts` reads the built stylesheet, and checks, beside the plan's pairs, the pairs
  components draw: primary and secondary text on muted, popover, and a selected row, accent and
  disabled text on a selected row; text on each filled status colour; on-light on on-dark, the media
  modes' text on each other; the on-dark icon on the scrim over a white image at 3:1, so Latte's
  scrim is 70% rather than 50%; each hue's text on its own background, and a banner's; syntax
  colours on the code background. Disabled text is held to 4.5:1 too, as the decision says "every
  text colour": the dim text is a step past the mockup's in both schemes, `#5f6276` and `#969db8`,
  for 4.5:1 on a selected row.
- **Rationale**: Astryx rounds each size of its type scale to a whole pixel, so a 16.8 px base drew
  17 px; explicit tokens win over the generated ones. The decision holds borders to 3:1 with no
  exception, so a pane's line is as strong as a control's: Catppuccin's lightest overlay step that
  reaches 3:1 in each scheme. The tints are light, since a tinted card holds its hue's text and
  secondary text (axe found Mocha's 20% tints at 4.2:1 under secondary text), and the human's
  message bubble must still read blue.
- **Alternatives considered**: Astryx's generated `color` palette from one accent: not Catppuccin.
  `--radius-full: 0px` everywhere: square status dots and radio buttons. Panes' lines in surface1,
  the mockup's quiet lines, at 1.6:1 to 1.8:1: against the decision's rule for borders. Exempting
  disabled text, as WCAG does: the decision names no exemption.
- **If wrong**: each role is one line of `theme.ts`'s `tokens`; the test names the pair that fails.
- **Where**: task 2, `packages/web/src/theme/theme.ts`, `src/__tests__/theme-tokens.test.ts`.

## R5: What the wider monospace text moved, and the checks that follow the 120% scale

- **Decision**: JetBrains Mono at 16.8 px runs wider than the old system font, and spacing grows by
  120% on the phone too. So: the verdict's button "Request changes and start the agent" reads
  "Request changes, start the agent", which fits the phone's width; a priority's "Draft" and "Start
  a change based on this line" wrap onto two lines rather than cut their labels; the sidebar opens
  290 px wide, not 280, so a feature's name fits beside its mark and menu, and the round's index
  gives the 10 px back, 230 px rather than 240, so the questions keep their 600 px at 1200 px and
  their options beside their titles at 1440; a change's round row in its session's column wraps its
  name rather than cut it (a label Astryx is given as a string, it cuts); inline code is 0.9em of
  the text around it; the reading measure is 86ch, about 110 characters of Inter, where 90ch
  held 116. The spec page's phone test checks the page's inset at 14.4 px, US5 3's 12 px at 120%,
  rather than 12.
- **Rationale**: each was a layout check that failed after the theme changed, for text cut or a line
  past the measure or the screen. The plan moves every spacing step's growth into the base, and the
  spec's "Text is 120% at every width, the phone included" makes the inset 14.4 px. WebKit placed
  `src/components/EditPanel.tsx` at the reading size on one phone line without its code padding, 2
  px past the column; a smaller code size fits it and matches the usual weight of code in prose.
- **Alternatives considered**: letting every button's label wrap, in the theme: Astryx's buttons
  have a fixed height. Keeping a 12 px inset on the phone: a size rule against the plan's one scale.
  Leaving the sidebar's width to Task 8: the checks fail until then.
- **If wrong**: each is one line: the label in `ReviewVerdict.tsx`, the width in `Shell.tsx` (Task 8
  replaces the sidebar, and can give the round's index its 240 px back), the code size, index, and
  measure in `theme.ts`, the inset in `spec.test.tsx`.
- **Where**: task 2, `packages/web/src/ReviewVerdict.tsx`, `pane/PriorityPane.tsx`, `Shell.tsx`,
  `ChangeAside.tsx`, `theme/theme.ts`, `__browser__/spec.test.tsx`.

## R6: A weekly window now gives the week, where it gave no report

- **Decision**: `usage.test.ts`'s case `{ rateLimitType: "seven_day", resetsAt, utilization: 0.43 }`
  leaves the "missing, weekly or malformed usage gives no report" list, renamed "missing or
  malformed usage gives no report". It checked that Uraeda ignored Claude's seven-day window, since
  it read only the five-hour one. The new tests check the opposite, as US3's Usage pane asks: a
  seven-day window, unified or direct, gives `week`; one with both windows gives both, each from its
  own numbers; a malformed seven-day window gives no week and keeps the five-hour one, and alone
  gives no report. A status-only `seven_day` notice joins the no-report list. A usage event now
  carries `fiveHour`, `week`, or both, and the processes keep each window's freshest report per
  process apart, so a report of the five-hour window alone keeps the week.
- **Rationale**: the old assertion guarded the five-hour-only reading, which the spec ends; the
  guarantees it held for malformed input stay, for both windows.
- **Alternatives considered**: a second event type for the week: two paths through the processes for
  one report. Clearing the week when a report lacks it: Claude sends five-hour-only notices between
  weekly ones, and the week would flicker away. The benchmarks' runner, which read `fiveHour` of
  every usage event, now counts a full week as the usage limit too, since a full week stops the
  agent as well.
- **If wrong**: the week is one field of the event and one map in `processes.ts`.
- **Where**: task 4, `packages/server/src/runner/__tests__/usage.test.ts`,
  `runner/claude-events.ts`, `runner/processes.ts`, `packages/benchmarks/src/session.ts`.

## R7: The session row's agent needs no web selection

- **Decision**: `SessionRowRecord.agent` reaches the web without a change to `src/views.ts`: the
  session list and search select their rows whole, `rows: true`. Only `AgentView` selects the new
  `weekLimit`.
- **Rationale**: the rows are JSON values of `SessionList`, not records of their own.
- **Alternatives considered**: none: there is no per-field selection of a row to add to.
- **If wrong**: should rows become records, their view selects `agent`.
- **Where**: task 4, `packages/web/src/views.ts`.

## R8: Deleting the prototypes rewrites every link to them

- **Decision**: the approval step deletes every file of `mockups/` that no link of `spec.md` names,
  with the files those load. It rewrites each link to a deleted file, in every Markdown file of the
  feature (proposal, discovery, questions, spec review, rulings, plan), into its text and the path
  in code. It matches on the path whatever the link's form: an image embed, or a link with a query
  or a fragment, like `terminal-2.html?w=1440#/home`. The deletion has its own trigger in the plan
  step: files of `mockups/` the spec does not link, still there, are deleted in the plan's commit,
  whatever approved the spec. So a spec with no decision to activate, approved by
  `ura review --approve`, whose review block is already a record, loses its prototypes too.
- **Rationale**: `ura check` reports `links.file` on a link into `specs/` whose file is gone
  (`crates/core/src/check/links.rs`), so leaving the round's links would fail the check after every
  approval, and links in the plan or the rulings, or embeds and links with a query, fail it as well.
  The approval step runs only for a spec with a decision to activate, and the plan step's record of
  the review only when no tool made it: tied to either, a feature would keep its prototypes forever.
- **Alternatives considered**: a `ura check` exemption for links into `mockups/`: code for a rule a
  sentence covers, and it hides real broken links in specs. Links to the file at a commit: a hash
  the agent cannot know before committing.
- **If wrong**: a later round reads only the text of a deleted prototype's link; `git log` on the
  path finds it. Task 14 of this feature deletes this feature's prototypes, and rewrites the links
  to them in `plan.md`, `spec.md`, `rulings.md`, the two rounds, and the two discoveries the same
  way.
- **Where**: task 5, `skills/uraeda/references/approval.md`, `plan.md`, `discovery.md`, `spec.md`.

## R9: A semi-wide browser test runs in the desktop instance, narrowed by `atSize("semi")`

- **Decision**: the browser instances stay the phone and the desktop. `atSize` reads a viewport's
  size as the width classes do, under 768 px the phone, to 1279 px semi-wide, from 1280 px the
  desktop, and accepts `"semi"`: such a scope runs in the desktop instance, skipped on the phone,
  and `atSize` itself narrows the window to 1205 × 900 before each of its tests and widens it back
  after. A test about a crossing, or about a touch screen at 1205 px, sets `page.viewport` itself.
  The place keepers, `useKeepPlace` and `useFollowEnd`, compare whether the layout is narrow, not
  the class, and the crossing test of the priorities' pane narrows the window to 500 px high, so its
  list scrolls at 1440 px too. A session crosses 1205 → 1440 → 1205 px in `session.test.tsx`, read
  mid-way and following its end: the place keepers' crossing is tested on the page that uses them.
- **Rationale**: a declared size is then the size the test runs at, with no resize to forget or to
  undo in a `finally`; a third instance would run every file a third time for a few tests. The place
  keepers put a place back when the page's layout changes, which 768 px does; at 1280 px the page
  keeps its layout and only the shell changes (Review focus 2). The shell's rail (task 8) has
  landed: crossing 1280 px now swaps the 52 px rail for the 256 px column, so the page's column
  narrows and its text wraps anew, and the session's 1205 → 1440 → 1205 px tests still pass with the
  keepers comparing `isNarrow`: the browser's scroll anchoring keeps the place read mid-way as the
  text rewraps, and the end followed stays the end. They fail when a keeper moves the place at 1280
  px (checked by a keeper that scrolls to the end there).
- **Alternatives considered**: a semi-wide instance in `vite.browser.config.ts`: a third run of all
  44 files. `"semi"` as an alias of `"desktop"`, each test resizing: the size declared and the size
  run would differ.
- **If wrong**: a scope declared `"semi"` that needs its own height sets `page.viewport` in its
  test; the hooks live in `__browser__/helpers.tsx` alone. If the rail and the column leave the
  session's column a different width, so its text wraps anew at 1280 px, the session's crossing test
  fails, and the keepers compare the whole class instead, in `useKeepPlace.ts` and `following.ts`.
- **Where**: task 3, `packages/web/src/__browser__/helpers.tsx`, `__browser__/layout.test.tsx`,
  `__browser__/session.test.tsx`, `useKeepPlace.ts`, `following.ts`.

## R10: A harness's mark is named once, by its kind, and stays silent beside its name

- **Decision**: `harnessMark(kind)` names `claude` "Claude Code", `codex` "Codex", `pi` "Pi", the
  fake agent's `fake` "Fake agent", and any other kind by the kind itself. Pi is drawn by a π made
  for Uraeda on Lucide's grid and stroke (`uraeda:harness-pi`), the spec's neutral Pi glyph; the
  fake agent and any unknown kind by Lucide's `bot`. `HarnessMark` is an image named by the harness,
  and takes `isDecorative` where its name is already said: a sidebar card says it in the link's name
  ("Why is CI slow?, session, Claude Code, …"), and the session header beside the agent's name.
  Codicons' marks and the generic glyph are registered as `uraeda:harness-claude`,
  `uraeda:harness-openai`, and `uraeda:harness-agent`. The session header marks and names the
  session's own kind, as its card does, and the configured agent only before the session exists.
- **Rationale**: Astryx's `Icon` warns against a label inside a link that already has a name, which
  would be read twice; the card's name is how a screen reader and the tests tell its harness. The
  server reports a session's kind only, so the web names it. The fake agent's adapter calls itself
  "Claude Code", which would hide that it is not.
- **Alternatives considered**: the mark labelled inside the card, read twice, or overridden by the
  link's `aria-label` and so never read; the adapter's own name on each row, a server change for a
  name the web can map.
- **If wrong**: a new harness shows its raw kind as its name until it is added to `harnessMark`, in
  one file. Pi's π is ours, not Pi's brand: a mark of Pi's own replaces it in `theme/icons.ts`.
- **Where**: task 7, `packages/web/src/HarnessMark.tsx`, `theme/icons.ts`, `sidebar/ItemCard.tsx`,
  `SessionHeader.tsx`, `SessionPage.tsx`.

## R11: Lucide's glyphs move out of the icons' registry, and a pane's title takes a level

- **Decision**: `theme/icons.ts`, at 494 lines, is split before Codicons' marks are added: Lucide's
  glyphs move to `theme/lucide.ts`, and `icons.ts` keeps the registries and the Codicons marks.
  `Pane` takes `level`, its heading's level, 2 by default, and names its `section` by its title
  alone, without the count. Its background, and its title's under the border, is the body's; its
  title is Catppuccin's lavender, the accent while active, peach for `attention`, red for `problem`.
- **Rationale**: the file limit is 500 lines; the plan's Step 3 asks for "a heading at the level the
  caller gives", which its interface left out; a name with the count would change as the count does
  and break every lookup by name. The mockup's titles are lavender.
- **Alternatives considered**: the marks in a file of their own, imported by `icons.ts`, which the
  plan names as their home; the title's background left to the caller, which shows the border
  through the title on any other background.
- **If wrong**: a pane on another background shows the body's colour behind its title: a `Pane` prop
  then picks it.
- **Where**: task 7, `packages/web/src/theme/lucide.ts`, `theme/icons.ts`, `layout/Pane.tsx`.

## R12: The "Later" edge stands 3:1, and its heading is what dims it

- **Decision**: `--color-border-gray`, the left edge of the priorities' "Later" section, takes
  Catppuccin's overlay step (Latte's overlay2, Mocha's overlay0), where it took surface2, about
  1.9:1 in Latte and 2.4:1 in Mocha. The contrast test checks it with every other border. "Later"
  stays the dimmer section by its heading, in the secondary text where "Next"'s is in the primary.
- **Rationale**: the UI look decision asks 3:1 of every border in both schemes. Overlay is
  Catppuccin's lightest step that reaches it, and already "Next"'s edge, so no edge both reaches 3:1
  and stays dimmer than "Next"'s.
- **Alternatives considered**: a stronger edge for "Next" (subtext0), changing
  `--color-border-emphasized` for every control that uses it; a dashed or thinner edge for "Later",
  a raw cue the tones do not have.
- **If wrong**: "Later" reads as loud as "Next" at a glance; a stronger edge for "Next" alone is a
  tone of its own in `lists/WorkList.tsx`.
- **Where**: `packages/web/src/theme/theme.ts`, `__tests__/theme-tokens.test.ts`.

## R13: The route table moves to its own module, once the shell landed

- **Decision**: the route table, `Route`, `parseRoute`, `parseLocation`, and the paths the pages
  build, lives in `routeTable.ts`, imported by `routeHistory.ts` and by `routes.tsx`, which
  re-exports it: the route history no longer imports the routes, so the two modules have no cycle.
  Task 3 left the cycle while the shell's rebuild (task 8) rewrote `routes.tsx`; with the shell
  landed, the move is a refactor alone.
- **Rationale**: the history read `parseLocation` only inside `navigate`, so the cycle was safe, but
  only by when it was read; a module of its own makes it safe by structure. The re-exports keep
  every importer of `routes.tsx` unchanged.
- **Alternatives considered**: keeping the cycle, safe while nothing reads the table at load;
  `routes.tsx` handing the history a page-of-path function at load, an indirection for one call.
- **If wrong**: a page or a hook that needs the table imports `routeTable.ts` directly; the
  re-exports in `routes.tsx` can go once nothing imports the table through them.
- **Where**: `packages/web/src/routeTable.ts`, `routeHistory.ts`, `routes.tsx`.

## R14: The shell's panes split the one Sessions list, New leads the column, and its panes are groups

- **Decision**: the column's panes of work are Needs you, then Sessions, the sessions without a
  workflow with their harness's mark, then In progress, the features and changes in flight, each the
  oldest started first, then Done. A feature's session stays on its feature's card, in In progress,
  so no item shows twice. New, a link styled as the primary button, and Note lead the column above
  the search, as the mockup draws them; "＋ New" leaves Sessions. The panes in the navigation, and
  on the phone's sessions page, are `Pane`s with `isGroup`, a `group` named by its title, as
  Astryx's `SideNavSection` was, not a `region`. The tests whose checked order or list the spec
  changes: `__tests__/sidebar.test.tsx` "the sidebar reads in the flow's order" (New, then
  Navigate's rows, then the panes) and "sessions, changes, and features share one list" (Sessions
  holds the session, In progress the feature then the change); `__browser__/change.test.tsx` (the
  change and the feature in In progress); `__tests__/usage.test.tsx` (the allowance in the "5 h
  window" pane at the column's foot, the feature's card in In progress);
  `__browser__/round.test.tsx` C3 at 1200 px (the shell is its 52 px rail there, and the questions
  keep their 600 px).
- **Rationale**: the spec lists Sessions and In progress as two panes, and the mockup's Sessions
  rows are sessions with a harness's mark while In progress holds features. A pane named by a region
  would put a landmark per pane in the navigation landmark, and collided with the feature page's own
  "Sessions" region in the happy-dom tests.
- **Alternatives considered**: Sessions holding every session row, a feature's too, beside In
  progress: one feature twice in the column. Regions: six landmarks inside one.
- **If wrong**: the split is two filters in `shell/ShellPanes.tsx`'s `Work`; `isGroup` is one prop.
- **Where**: task 8, `packages/web/src/shell/ShellPanes.tsx`, `layout/Pane.tsx`,
  `shell/ColumnPanes.tsx`.

## R15: On the phone, the repository menu and the ＋ forms head the Sessions tab's page

- **Decision**: `/sessions`, the Sessions tab's page, starts with the repository menu, with the
  logo, then its heading, then "＋ Note" and "＋ Priorities" (named "Add a note to the inbox" and
  "Add to the priorities", as the column's ＋), the search, the panes, and the 5 h window. Tests
  that opened the phone's drawer open the Sessions tab instead:
  `__tests__/repository-menu.test.tsx`, `quick-add.test.tsx` (three taps, under the four the test
  allows), `feature-settings.test.tsx`, `inbox.test.tsx`; `__browser__/inbox.test.tsx` (back to the
  inbox by its tab once the note is added), `fields.test.tsx`, `repositories.test.tsx`,
  `shell-checks.test.tsx`, `usage.test.tsx`, `layout.test.tsx`, `new-change.test.tsx` (New is the
  tabs' last link).
- **Rationale**: the tabs hold seven pages at 390 px with no room for the menu; the sessions page
  holds what the column holds that the tabs do not, so the phone keeps every guarantee of the old
  drawer in one place.
- **Alternatives considered**: the menu at the top of Home: Task 10 rebuilds the home. A logo tab
  opening the menu, as the mockup's style sheet allows: an eighth tab at 390 px.
- **If wrong**: the menu moves with one line of `shell/SessionsPage.tsx`.
- **Where**: task 8, `packages/web/src/shell/SessionsPage.tsx`.

## R16: The column's width and fold under `uraeda.nav`, and no fold by dragging

- **Decision**: `uraeda.nav` holds `{ width, folded }`, JSON. Astryx's old key is read when the new
  one is absent, its `size` (or a bare number) clamped to 220–480 px and its `isCollapsed` kept as
  the fold, written to the new key, and removed (`__browser__/shell.test.tsx`). Dragging the edge
  stops at 220 px and never folds: the fold is the button and `[` only.
  `__browser__/sidebar.test.tsx`'s resize test checks 220–480 and a drag to the fold button stopping
  at 220, where it checked 200–480 and a fold under 160. The edge's grab zone is centred on it
  (`pillPlacement="center"`): Astryx's default put it inside the column, off the edge a pointer
  grabs. The fold is kept in the browser, as Astryx kept it.
- **Rationale**: the spec's edge case "it stops at 220 px and at 480 px".
- **Alternatives considered**: Astryx's `autoSaveId`, which stores under its own prefix and has no
  width that follows the window until a drag.
- **If wrong**: the limits and the key are constants of `shell/columnWidth.ts`.
- **Where**: task 8, `packages/web/src/shell/columnWidth.ts`, `shell/Column.tsx`.

## R17: In the column, a card's name reads whole, wrapping, with its step under it

- **Decision**: a card in the shell's panes, in the column and on the phone's `/sessions`, is a row
  of our own, `sidebar/CardRow.tsx`, drawn from Astryx's shared nav-row styles: its kind's icon, its
  whole name, which wraps onto a second line when the column is too narrow for it (a slug breaks at
  its hyphens), a change's or a feature's step on the line under the name, as the mockup draws it,
  then its status at the end and its "…" beside the link. No line is clamped and nothing is cut: the
  layout checks' exemption of the cards' names in the navigation, a dialog, or a pane is gone
  (`__browser__/helpers.tsx`), and a task's progress and a sub-agent's description wrap too. The
  card's accessible name reads its name, then its step, then its title, kind, and status, so the
  link's name holds its visible text in order (axe's label-in-name). The other rows stay Astryx's
  `sm` rows, and on the rail a row's count is a dot over its icon. The tests whose checked names
  this order changes: `__tests__/sidebar.test.tsx` (the web-ui card, the problem cards),
  `__tests__/shell.test.tsx` (US2.1), `__tests__/feature-settings.test.tsx` (the renamed card),
  `__browser__/change.test.tsx` (the change's card, whose step, "Change", is the one "Change" shown
  in In progress). No age shows on the second line: the cards carry no time to tell it from.
- **Rationale**: the human's own words for the feature: "Make sure text is readable: full title for
  features, information of a second line", and readability first. `SideNavItem` takes its label as a
  string, on one line, cut by an ellipsis; the 256 px column leaves a name about 124 px beside its
  icon, status, and "…", which cut `recurring-tasks`.
- **Alternatives considered**: the names cut by an ellipsis, exempted from the layout checks, the
  first build of this task; a two-line clamp, which still cuts a long session's title, and which the
  checks forbid; the step line outside the link, which a click on it would not open; a 290 px least
  width, against the spec.
- **If wrong**: a name too long for comfort takes three lines or more; a clamp is one style of
  `CardRow.tsx`, with a precise exemption in `checkPage`. An age on the second line needs the time a
  card's item started, from `cards.ts`.
- **Where**: `packages/web/src/sidebar/CardRow.tsx`, `sidebar/ItemCard.tsx`,
  `__browser__/helpers.tsx`, `__browser__/shell.test.tsx`.

## R18: How the rail opens and folds

- **Decision**: on a semi-wide screen the rail opens over the page once the mouse rests on it for
  250 ms, on a keyboard's focus inside it (`:focus-visible`, so a click on a link does not hold it
  open), or on a tap of its logo button, "Open navigation"; it folds as the mouse leaves, as the
  focus leaves, on Escape, which, inside it, moves the focus to the logo and keeps the rail folded
  until the focus leaves, and, outside it, folds it unless a dialog or a popover is open, on a tap
  outside, and on the page a tap opened. A row the keyboard focuses in the folded rail keeps the
  focus as the rail opens: the open rail's row to the same page, or of the same name, takes it, the
  folded icon being a different element. The 250 ms rest is tested with fake timers
  (`__tests__/rail.test.tsx`). Folded, its rows are icon buttons named as their rows, and its panes
  lines of icons; open, the column's own rows. The wide column folded by `[` is the same rail of
  icons in the page's flow, which does not open over the page: the fold button unfolds it.
- **Rationale**: a click on an icon on the mouse's way in would land on the row the opened rail
  draws there; a rest first keeps the icon under the click. The wide fold's tests (C3, the button at
  the same spot) need the rail to stay folded under the pointer.
- **Alternatives considered**: the mockup's CSS, opening on `:hover` at once over the same rows,
  clipped: a row's label shows in part in the 52 px, and `SideNavItem` cannot hide it.
- **If wrong**: the delay is `HOVER_MS` in `shell/Rail.tsx`.
- **Where**: task 8, `packages/web/src/shell/Rail.tsx`, `shell/Column.tsx`.

## R19: The page's slot, the tabs' names, and what the shell's panes moved in the theme

- **Decision**: until Task 9's status line, a page's slot (the round's count and Next) is a row at
  the top of the page on semi-wide and wide screens, and on the phone a second row of `--spacing-12`
  under the tabs, in the sticky header, which is the page's `banner`; a question's sticky header on
  the phone stays under both rows, `2 × --spacing-12`. A tab with a count is named by its page then
  its count, "Inbox, 10 notes", "Sessions, 3 running", as axe asks a name to hold the text it shows.
  The theme's rule that wraps a tool call's text is `!important`: the panes, drawn on every page,
  emit Astryx's atomic `white-space: nowrap` outside any layer, which beat the theme's layer. The
  round's index takes its 240 px back (R5), the shell being a 52 px rail at 1200 px. The page is
  Astryx's `LayoutContent` with `role="main"`, as `AppShell` drew it.
- **Rationale**: the phone's old top bar held the slot in its one row, which the seven tabs fill.
- **Alternatives considered**: the slot at the top of the page on the phone too: the round's Next
  would scroll away.
- **If wrong**: Task 9 moves the slot; the offset is one line of `QuestionCard.tsx`.
- **Where**: task 8, `packages/web/src/Shell.tsx`, `shell/Tabs.tsx`, `QuestionCard.tsx`,
  `theme/theme.ts`.

## R20: The status line: no mode pill, hints off on the phone, and the page's slot in it

- **Decision**: the status line is one row fixed at the window's bottom at every width,
  `--spacing-8` tall, and on the phone `--spacing-12`, as tall as the tabs, since it holds the
  page's slot (the round's count and Next), which moves there from R19's rows: the phone's sticky
  header is the tabs alone again, and a question's sticky header sits one row under the top. The
  shell lowers `--size-viewport-height` by the line's height and pads the page's end by it, so the
  column, the side columns, and the round's index end above the line, and no page's end hides under
  it. It shows the hints the page declares, then the shell's (`[ fold` on wide), then "N need you"
  in the attention colour, left out at none, and "N running" with the activity icon. On the phone it
  shows no hints: a phone has no keys, and every key hint today is off there but the lists', whose
  room the slot and the counts need. No mode pill: the mockup's pill named the page, which the
  column or the tabs already mark, so it carried no information. Keys are a raw `kbd` in the line,
  not Astryx's `Kbd`, which writes them in capitals ("J K", "Esc") where the plan writes "j k" and
  "esc". The line is a `footer`, the `contentinfo` region "Status line", with no live region: the
  counts change as sessions run, and the panes and tabs already say them where they are read. `]`,
  which folds a page's side column, gets no hint yet: the task names the keys to declare, and the
  keyboard feature adds the rest. A sheet that leaves the page usable, as a comment's on the phone,
  is no modal, so not in the top layer, and the fixed line covered its foot and its Add comment:
  while one is open, the line is left out (`useCoverStatusLine` in `Overlay.tsx`). Tests changed
  with what they check: the round's test that found Next in the `banner` finds it in the status
  line, and Storybook's page and a session's side column, "as tall as the window", now reach the
  status line's top.
- **Rationale**: the spec puts the counts and hints at the bottom at every width; the round's Next
  in the same line keeps it in reach of the thumb and in view, as R19 wanted.
- **Alternatives considered**: the line in the page's flow, sticky at its bottom: the column and the
  side columns, as tall as the window, would still pass under it. Hints cut to fit on the phone:
  keys a phone cannot press.
- **If wrong**: the slot goes back to R19's rows in `Shell.tsx`, and the question's offset in
  `QuestionCard.tsx` to two rows.
- **Where**: task 9, `packages/web/src/shell/StatusLine.tsx`, `statusHints.tsx`, `Shell.tsx`,
  `QuestionCard.tsx`, `layout/Overlay.tsx`, `__tests__/round.test.tsx`,
  `__browser__/storybook-page.test.tsx`, `__browser__/side-column.test.tsx`.

## R21: Home's rows are the shell's card row, with the whole title and a second line

- **Decision**: every row of home is `HomeRow` (`home/parts.tsx`), drawn by R17's `CardRow`: its
  icon, the feature's whole title (not its label or slug, as the column shows), wrapping, a second
  line, and at its end the action a gate asks ("Answer", "Review", "Write", "Fix") or the session's
  `StatusMark`; its link's name reads that text in order. `CardRow`'s link is now `RouterAnchor`, so
  a page of the UI opens without reloading, from home and from the column alike, and its "…" is
  optional: home's rows have none, the settings staying on the column's cards and the feature's
  page. Problems lists the features whose problems stop the workflow (`FeatureView.problems`, the
  core's `BLOCKING` rules), each with its first problem's message and "Fix", the "Fix" rows Needs
  you held. Needs you's second line is the gate's short name, a new `name` of `waiting()`
  ("Questions", "Spec", "Plan", "Proposal"), then the round's waiting line; the verb stays "Review"
  for a spec or a plan, the mockup's "Approve" being in no scenario. In progress is the features an
  agent works on, its second line the step, "task n of m", and the task, its end the status of its
  session as the column's card shows it (`featureStatus`), with no segmented step bar. Sessions is
  the sessions without a workflow, not archived or done, what needs the human first, each with its
  harness's mark and name. No key hints "1", "2", and no "All sessions" link: the column lists them,
  and the phone's Sessions tab.
- **Rationale**: the human's words, "full title for features, information on a second line", and one
  component for a row of an item (UI coherence). US3 1 names "a `spec.md` lacks a required section",
  which the [problems](../decisions/problems.md) decision makes a note, not a problem: the tests use
  an unreadable status, which stops the workflow, and a plan missing a section stays In progress
  with no Problems pane. US3 3 names "Layout and look and feel"; the fixture's feature waiting for
  answers is "Web UI for the workflow files".
- **Alternatives considered**: the column's `ItemCard` on home: its label is the slug, and its "…"
  would repeat every card's settings button on the page. Astryx's `ListItem`, home's old rows: a
  second look for the same item. A segmented bar of the steps: a drawing for information the step's
  name already gives.
- **If wrong**: a row's look is `HomeRow` and `CardRow`; the verb is `gateAction` in `labels.ts`.
- **Where**: task 10, `packages/web/src/home/parts.tsx`, `home/Core.tsx`, `sidebar/CardRow.tsx`,
  `labels.ts`.

## R22: The "Overview" line is a heading, and the columns follow the width class

- **Decision**: the dashed line is a level-2 heading, "Overview", between two dashed rules hidden
  from screen readers; the core's panes are level 2, the widgets' level 3, under it. From semi-wide,
  In progress and Sessions share a grid of `1.2fr 1fr`, as the mockup draws them, and the widgets a
  grid of two even columns, by rows: Priorities now beside Usage, Inbox beside Recent; on the phone,
  one column in the same order. The page is `Page`, centred in the room the shell leaves.
- **Rationale**: a heading names what follows for a screen reader's list of headings, which a
  `separator` cannot hold. `useWidthClass` is the one owner of the classes; a grid by rows keeps the
  panes' order the reading order.
- **Alternatives considered**: CSS columns, the mockup's masonry: it fills down the first column, so
  the reading order and the tab order differ from the eye's. Auto-fit columns of a least width: one
  column at semi-wide beside a pane, against SC-003.
- **If wrong**: the grids are `Columns` in `home/parts.tsx`.
- **Where**: task 10, `packages/web/src/home/parts.tsx`, `home/HomeHub.tsx`,
  `__browser__/home.test.tsx`.

## R23: Home's widgets, and the tests that read home's old cards

- **Decision**: Priorities now lists the first five of Ongoing and Now (`prioritySection("now")`),
  the second line "Ongoing · " and the running entry's status, else "Draft", "Backlog", or "Not
  started", then "Open priorities". Usage shows the agent's mark and name, then the 5 h window and
  the week, each "N% used", its reset time (with its weekday for the week), and its bar; a report
  without the week shows no week (Review focus 6), and before any report, "No run reported usage
  yet."; the mockup's "Warning at N%" has no setting behind it and is left out. Inbox lists the
  three latest notes, each with its category, then a link to the inbox named by the count, "10 notes
  to organize", or "Open the inbox" when empty. Recent is the column's Done rows (`doneRows`), the
  latest five then "Show all (n)", all at `#done`, its second line "Merged" or "Session". Home no
  longer shows Next, its count tiles, or the decisions' card, which the column's Navigate holds.
  Tests changed with what they read, never what they check: `__tests__/home.test.tsx` rewritten for
  US3 (its Next and tiles tests gone with them); the link `^Priorities, open the priorities page` is
  "Open priorities" in `repositories.test.tsx`, `repository-menu.test.tsx`, and
  `__browser__/task.test.tsx`; the inbox's count link is "10 notes to organize" in `inbox.test.tsx`;
  `links.test.ts` waits on "Overview" for home; `feature-page`'s working agent is read in In
  progress; and the task view opened beside home, in `__browser__/task.test.tsx` and
  `layout.test.tsx`, opens from Priorities now, the fixture's Next entries moved into Now first
  (`nowHoldsNext`), so the task's section is "Now".
- **Rationale**: the spec's widgets, and the decision against count tiles; the words the tests wait
  on, "Needs you" and "Priorities", stay on home.
- **Alternatives considered**: a Now and Next switch on home: the spec names "the priorities now". A
  link from the pane's title: `Pane`'s title is a heading in the border, not a link.
- **If wrong**: each widget is one component, in `home/HomeHub.tsx`, `home/Usage.tsx`, and
  `home/Recent.tsx`.
- **Where**: task 10, `packages/web/src/home/`, `__browser__/helpers.tsx` (`nowHoldsNext`), and the
  tests named above.

## R24: Settings on one form: rows as headings in a list, the search under the heading on a phone

- **Decision**: the settings page is one form of six `Pane` sections, each setting a row of a list:
  its icon, its name as a level-3 heading, its line of help, then what the page says of its value (a
  flag in force, a refusal), and its control at the end, under the text on narrow screens. Each
  setting's icon and help live in `categories.ts`, which the rows and the search both read; the
  search matches a row's name, help, terms, or section, and the settings to come are rows too, with
  a clock and "Comes with <feature>." and no control. The help lines are today's texts, which
  already say when a change applies, as the settings decision asks; the switches keep their names
  for screen readers with the label hidden, the row's heading showing it. `/settings/<category>`
  draws the same form and scrolls that section into view, unless the entry has a saved position
  (Back, reload); an unknown category reads as none. A file that cannot be read shows its problem in
  Server and Runs, the Runs section keeping its rows to come; Appearance and Sign-in, which do not
  read the file, keep their controls. The search sits at the end of the heading row on wide screens,
  and under the heading on narrow ones, where it was above it: with one form and no category pages,
  the heading leads the page at every width. New Lucide glyphs registered for the rows: `server`,
  `globe`, `plug`, and `log-out`. Tests changed with what they check: the index's, the phone's
  category pages', the results list's, and the unknown category's tests became the form's (order,
  rows, deep link, search filtering rows); the two file-problem tests scope their check to a
  section, since the problem now shows twice; `__browser__/layout.test.tsx` waits for "Allowed host
  names" and the search's rows, and draws `/settings/runs` in place of the Server and Sign-in pages
  (Sign-in stays drawn by `sign-in.test.tsx`); `story-embed.test.tsx` picks the scheme on the form,
  one history entry fewer; the screenshot script shoots the form's views.
- **Rationale**: the spec's US5, with the review's C4 (the form only), and the plan's review focus
  8: links to a section keep working. A heading per setting gives a screen reader the form's
  outline, and the tests a user-facing way to read which rows show.
- **Alternatives considered**: Astryx's `ListItem` for a row: its end slot stays at the end, so a
  phone could not put the control under the text. Dropping `/settings/<category>`: links in
  documents and tests would break. Hiding the planned rows from the search: they were found before.
- **If wrong**: the row is `settings/SettingRow.tsx`; the search's matching is `settingShown` in
  `categories.ts`; the scroll is `useScrollToSection` in `SettingsView.tsx`.
- **Where**: task 11, `packages/web/src/settings/*`, `theme/icons.ts`, `theme/lucide.ts`,
  `scripts/settings-shots.ts`, `__tests__/settings.test.tsx`, `__browser__/layout.test.tsx`,
  `__browser__/story-embed.test.tsx`.

## R25: The decisions' reader stays open, Escape returns it to the constitution

- **Decision**: on wide and semi-wide screens the reader is always open: `/decisions` shows the
  whole constitution in it, the list marking principle I, and `/decisions/constitution/<slug>` the
  same reader scrolled to that principle. The reader has no Close; Escape from a decision or a
  principle returns to `/decisions`, and does nothing there. The browser test that ended with Escape
  closing the pane, no `Detail` region left, now ends with the reader on the constitution. The
  reader's pane is named by the file it shows, `specs/CONSTITUTION.md` or
  `specs/decisions/<name>.md`, the title being the reader's own heading; its head holds Previous and
  Next, in the list's order, and on the phone the way back, "Constitution and decisions". The list
  is `--size-ledger-list`, `max(320px, 30vw)`: 30% of the window, and never under 320 px, where less
  would cut the titles (361 px at 1205, 320 px only under 1067); `Panes` takes it as `listWidth`,
  the inbox and the priorities keeping their 40% detail. A principle's row is its numeral, title,
  first rule, and count of rules; a decision's adds its count of rules before its date, left out at
  none. The constitution's version line moves from the list to the reader. `PrincipleDetail`, the
  reader of one principle, is gone.
- **Rationale**: the spec's reader is "open by default", and a principle "opens the whole
  constitution in it"; with nothing to close, Escape's nearest meaning is back to the start.
- **Alternatives considered**: Escape closing the reader to the list alone, as before: the spec
  keeps it open. The pane's title repeating the entry's name, as the mockup does: it says twice what
  the heading under it says.
- **If wrong**: `onClose` in `DecisionsPage.tsx`'s `LedgerList`, and the browser test's last lines.
- **Where**: task 12, `packages/web/src/decisions/DecisionsPage.tsx`, `ConstitutionReader.tsx`,
  `ConstitutionRegion.tsx`, `DecisionList.tsx`, `layout/Panes.tsx`, `App.tsx`, `theme/theme.ts`,
  `__browser__/decisions.test.tsx`, `__tests__/decisions.test.tsx`.

## R26: A decision changed on a branch: any feature in flight, from its branch changes

- **Decision**: "a decision changed on this branch" is read as on any feature's branch in flight,
  since the server reads the default branch whatever is checked out. The reader asks each feature
  with a branch for its branch changes, which the shell's cards already request, and only for those
  whose files hold `specs/decisions/<name>.md`, the branch's decision; each draws the spec page's
  `DecisionCard`, its changed parts only, under "Proposed by <feature>, on its branch", before the
  decision's document. A branch that removes the file shows no card, having no decision to read. The
  branch changes list their first 50 files by path, so code (`crates/`, `packages/`) sorts before
  `specs/decisions/`: when the list is cut short (its count past its files), the branch's decision
  is read anyway, and a decision the branch leaves as it is (no field changed, every part kept)
  shows no card. `decision-rules.test.tsx`'s comparison of the two pages finds the rule twice now,
  in the diff and in the rules, and compares the rules' (`DecisionRules`), after the diff.
- **Rationale**: no new server data; the branch changes are requested and cached already, and a
  decision's read is asked of a branch whose changes list holds its file, or is cut short before it.
  That second case costs the most: a feature whose branch changes more than 50 files (most features
  with code, whose `crates/` and `packages/` files sort first) gets a branch-decision read, a core
  read on the server, for every decision opened, whether its branch touches the decision or not;
  each read is cached, so opening the same decision again costs nothing more.
- **Alternatives considered**: the checkout's current branch only: the server does not read it. The
  branch's decision asked of every feature for every decision opened: a core read each, and an
  unchanged decision still answers a change to tell apart. A ledger field of the branches changing
  each decision: new core and server work for the same answer.
- **If wrong**: a field on the ledger's decisions, read by the core, replaces `useBranchChange`; the
  same field, or a branch changes list filtered to `specs/`, if the reads for long branches slow the
  reader down.
- **Where**: task 12, `packages/web/src/decisions/BranchChange.tsx`, `DecisionDetail.tsx`,
  `__tests__/decision-rules.test.tsx`.

## R27: The review's fixes to tasks 9 to 12

- **Decision**: the commit bar and a session's composer stick at `--size-status-line` from the
  window's bottom, 0 outside the shell, as in a story. The status line's counts wrap onto a second
  line when short of room, at 320 px beside a round's controls, each count whole. `useListKeys`
  takes `escapeLabel`, "close" by default, `null` to leave Escape's hint out. The constitution's
  reader scrolls to the principle unless it is first drawn on an entry with a saved place (the
  pane's on wide screens, the window's on the phone), and the list pane's `follow` forgets the
  pane's saved place, which was the row left's. A list of branch changes cut short is read past
  (R26). The rows' refusals live above the search (`RefusalsProvider`, `useRefusal` in
  `settings/SettingRow.tsx`), so a row hidden and shown again keeps its error. The column's Done
  rows are `CardRow`, as home's Recent. The "Overview" line stays our own, Astryx's `Divider` being
  a `separator`, whose label cannot be a heading (plan, Complexity tracking). `searchSettings` is
  gone with the results list that used it; its test rows read `shownLabels` across the sections, the
  form's own filter, and the empty search's row, which said the results list showed nothing, is
  dropped: the form tests show every row for an empty search. `--size-settings-index` is
  `--size-settings-search`. `__browser__/fields.test.tsx`, which found the composer docked at 0 px
  from the bottom, finds it at the status line's height.
- **Rationale**: the review of tasks 9 to 12: nothing under the fixed line, the UI behaviour
  decision's places and errors kept, one component for a done item.
- **Alternatives considered**: a list whose Escape does nothing hiding its hint by itself: the hook
  cannot tell, the caller does. A refusal cleared as its row hides: against "an error stays until
  dealt with".
- **If wrong**: the offsets are in `CommitBar.tsx` and `SessionPage.tsx`; the guard is
  `ConstitutionReader.tsx`'s `restores`.
- **Where**: `packages/web/src/CommitBar.tsx`, `SessionPage.tsx`, `shell/StatusLine.tsx`,
  `statusHints.tsx`, `lists/useListKeys.ts`, `lists/listPane.ts`, `decisions/`, `settings/`,
  `sidebar/DoneArea.tsx`, `__tests__/settings.test.tsx`.

## R28: The palette: Astryx's `CommandPalette` inline in our dialog, the preview beside it

- **Decision**: `JumpPalette` keeps Astryx's `CommandPalette`, `isInline`, inside an Astryx `Dialog`
  of its own on wide and semi-wide screens, the preview a sibling beside it in a two-column grid. A
  part in the palette's footer reads the cursor from `useCommandPaletteContext()`, puts it on the
  first result after each letter (R1), and lifts the entry under it to the preview. The entries are
  grouped Constitution, then Decisions, before a search, and ranked by the search after: a
  principle's numeral or a whole title, then a title's start, a word's start, anywhere in the title,
  then in the first sentence (a principle's first rule), ties in the list's order, so the groups
  follow the best match. On narrow screens the palette is a bottom sheet, its list alone, with no
  preview: a phone opens the reader in one more tap, and a sheet has no room for both. The palette
  adds a history entry, as `Overlay` does, so Back closes it, and Enter opens the entry once that
  entry is gone. `/` opens it unless the focus is in a text field, a dialog, a menu, a listbox, or
  the owner of an open popup (`aria-haspopup`, or a combobox, expanded), or a modal dialog is open;
  an expanded disclosure, as the rail's logo, holds no key back; it declares "/ jump" in the status
  line. SC-005 is measured as the letters typed between `/` and Enter: every entry of this
  repository's own ledger, 31 of them, is the first result of some query of three letters or fewer,
  checked in `palette.test.tsx` against `readLedger` of the repository. The fixture has no
  Notifications decision: both tests commit one.
- **Rationale**: inline, the palette keeps Astryx's combobox, listbox roles, grouping, hover, and
  announcements, and only the layout around it is ours. Inline, its field does not focus itself, so
  `JumpPalette` focuses it; its Escape is handled by the field before the dialog's layer stack,
  which stands down, and the closing is guarded against a second call. Three keys in all, `/`, a
  letter, and Enter, cannot tell 31 entries apart.
- **Alternatives considered**: the modal `CommandPalette` with the preview in its footer slot, under
  the list: not the mockup the human picked. Our own palette on `Dialog`, `TextInput`, and `List`:
  our own keyboard and roles for the same result. A preview under the list on the phone: the list
  then shows two or three rows.
- **If wrong**: `isInline` is documented for previews only; a later Astryx that changes it moves the
  palette to the fallback, contained in `JumpPalette.tsx`. A narrower list or a preview on the phone
  is a change of `Search`'s place in `JumpPalette`.
- **Where**: task 13, `packages/web/src/decisions/JumpPalette.tsx`, `jump.ts`, `DecisionsPage.tsx`,
  `theme/theme.ts`, `__tests__/palette.test.tsx`, `__browser__/decisions.test.tsx`.

## R29: The tail's place kept after "Show earlier messages" on a busy machine: a press waits for its draw

- **Decision**: `session-tail.test.tsx` "US1.2" failed once on the phone under load, "expected
  761.875 to be ≤ 1": the 20 messages the press adds (761.875 px) drew above the message read, and
  nothing put it back. The cause was in the app: `keepPlace` (`keepPlace.ts`) called the press's
  change without awaiting the promise it returns, and corrected two frames after the press, so when
  the earlier messages drew later, as on a busy machine, the correction found nothing moved.
  Awaiting it alone left the second press of `readFarBack` waiting forever: `tail.tsx` resolved a
  press from the walk's layout effect, while the walk hands its pieces to `sink` as it renders, so a
  render React sets aside could draw them through `Pieces` without that effect. Fixed: `Pieces`
  resolves the presses from its own layout effect, with the pieces that commit draws, once they hold
  the press's count (`next`) or offer nothing earlier; a press no longer keeps the pieces it left,
  the count alone says it is drawn. The key of the pieces drawn, which the walk compares with its
  own to ask for a redraw, is also read from that commit, where `Pieces` wrote it as it rendered.
  `keepPlace` awaits a change's promise, then counts its two frames, and the test polls the place
  back within a pixel instead of measuring right after the count draws.
- **Rationale**: what is on the page is known from the commit that draws it, not from the walk's
  render, which may never commit. The count says the earlier messages are drawn; the pieces' key
  also changes when a message arrives at the end, which would end the press too early.
- **Alternatives considered**: awaiting the press in `keepPlace` alone: the second press's place is
  never kept. Comparing the drawn key with the key the press left, as first proposed: a new page at
  the end ends the press before its messages draw. Polling the place in the test alone: fails while
  the app loses it.
- **If wrong**: a press that never draws its count, and still offers earlier messages, keeps its
  place waiting until the page closes, and the next press's correction puts it back; the unit test
  in `keep-place.test.ts` and US1.2 say which half broke.
- **Where**: `packages/web/src/keepPlace.ts`, `packages/web/src/tail.tsx`,
  `__tests__/keep-place.test.ts`, `__browser__/session-tail.test.tsx`.

## R30: The stories draw the fixture's states, and a width class through the width queries

- **Decision**: the shell's stories, `shell/Shell.stories.tsx`, draw the real `Shell` around the
  real `Home`, over the Storybook fixture, and replace `sidebar/Sidebar.stories.tsx`, whose fixed
  props drew states the fixture cannot (no work in flight, a card committing, the rail folded by
  `[`). A semi-wide or narrow story answers the width queries as a 1205 or 402 px window while its
  frame is wider (`.storybook/widthClass.ts`, a story's `beforeEach`): `useWidthClass` asks
  `matchMedia`, so the real components lay out for that class in the desktop's frame, while CSS
  keeps the frame's width (`30vw` is 432 px, not 361). The semi-wide shell's story opens its rail by
  a DOM click on its logo, once the home is drawn: Testing Library's click focuses the button first,
  which reads as the keyboard's focus (`:focus-visible`) and opens the rail, so its click folded it
  again. The home's stories show the Problems pane: the fixture holds "Due dates", whose status the
  workflow cannot read, and one Storybook server serves one fixture to every story, so no story can
  draw the home without problems; that state is the same page without the pane, checked by
  `__tests__/home.test.tsx`. The decisions' `List` story is `Constitution`, nothing open, the reader
  on the constitution (R25); `Principle` opens principle III, as the spec's mockup did;
  `ChangedDecision` opens "Task storage", which the spec page's features change on their branches
  (R26); `Palette` opens the palette by "Jump to…" and types "task". The spec's last settings
  mockup, "the file and a picker", becomes "Settings, a search", the review's C4 having dropped the
  file view.
- **Rationale**: the preview decision: real components, the real server, no faked response. A story
  frame is a phone's or a desktop's width, so a semi-wide state needs the desktop's frame to answer
  as one.
- **Alternatives considered**: a width class passed down by a context of `useWidthClass`: code in
  the app for stories alone. A second fixture without the blocked feature: a second server in
  Storybook, or a story-local repository, which the server's locked list (`lockedList`) refuses.
  Keeping the fixed props of the sidebar's stories: a second drawing of the shell, against the
  decision.
- **If wrong**: a story for the home without problems needs a fixture per story; the width answer is
  one helper, and its stories two lines.
- **Where**: task 14, `packages/web/src/shell/Shell.stories.tsx`, `Home.stories.tsx`,
  `decisions/DecisionsPage.stories.tsx`, `.storybook/widthClass.ts`, `spec.md`.

## R31: The screenshots of the redrawn views, and the script's views the shell left behind

- **Decision**: `scripts/screenshots.ts` waits on home's "Overview" line, where it waited on the
  decisions' card home no longer shows, and `scripts/layout-look-shots.ts` takes the decisions'
  views (moved from `screenshots.ts`, waiting on principle I's title, which the phone's list shows
  without the reader's version line), a decision a branch changes, the palette, the home and the
  shell at 1205 px (`home-1205`, `shell-1205-open`, desktop only), and the phone's Sessions tab.
  `settings-footer` is gone: it opened the phone's drawer, which the tabs replaced, and the form's
  shots show Settings selected. The feature's screenshots are `home`, `home-1205`,
  `shell-1205-open`, `sessions`, `decisions`, `decision`, `decision-changed`, `decisions-palette`,
  and the settings views, in `screenshots/`. The prototypes' screenshots went with `mockups/`.
- **Rationale**: the UI checks decision asks for screenshots of every changed view at both sizes and
  in both themes; the spec names 1205 px for the shell and the home.
- **Alternatives considered**: a third size in every view: three times the files for pages that lay
  out alike at semi-wide and wide.
- **If wrong**: the other views that open the phone's drawer by "Open navigation" (`sidebar`,
  `sidebar-no-match`, `quick-add`, and the inbox's, sessions', changes', and merge-chats' views)
  fail on the phone until their feature's next screenshots move them to the Sessions tab, as R15 did
  for the tests.
- **Where**: task 14, `packages/web/scripts/screenshots.ts`, `layout-look-shots.ts`,
  `settings-shots.ts`.

## R32: StyleX compiles dev's styles with the build's keys, so ours replace Astryx's in dev too

- **Decision**: in Storybook's dev server, `CardRow`'s rows kept Astryx's compact height and the
  links overflowed them onto the next row. The cause: StyleX's `debug`, on by default in dev, keys a
  compiled style by its property's name and hash (`height-kZKoxP`), where Astryx ships its styles
  compiled for production, keyed by the hash alone (`kZKoxP`). `stylex.props` then kept both
  `navItemStyles.sm`'s height and `CardRow`'s `height: auto`, and the order of the stylesheets
  picked, which differs between the dev server, where Astryx is pre-bundled, and the build.
  `vite.transforms.ts` sets `debug: false`: dev keeps its readable class names
  (`CardRow__styles.row`) but drops the `data-style-src` attribute, which nothing reads. Measured in
  WebKit on a cold Storybook: the home's and the shell's rows are as tall as their links, as in the
  build.
- **Rationale**: one config line makes every override of an Astryx style behave in dev as in the
  build, where a fix in `CardRow` would leave the others to the stylesheets' order.
- **Alternatives considered**: a stronger selector or an `!important`-like trick in `CardRow`: out
  of StyleX's model, and for one component. Pre-bundling Astryx differently: the keys would still
  differ.
- **If wrong**: a StyleX debugging tool that needs `data-style-src` turns `debug` back on for a
  session, and dev's overrides of Astryx's styles again depend on the stylesheets' order.
- **Where**: `packages/web/vite.transforms.ts`.
