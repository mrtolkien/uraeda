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
