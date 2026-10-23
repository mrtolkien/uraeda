---
status: auto-approved
spec-revision: 1
---

# Plan: Layout and look and feel

**Goal:** the web UI takes the terminal look, a shell built for three widths, and new home,
settings, and decisions pages, with the workflow allowing throwaway prototypes in investigations.

**Architecture:** the look is one Astryx theme: Catppuccin token pairs (Latte in the light slot,
Mocha in the dark one), JetBrains Mono by default and Inter for prose, square corners, 120% sizes at
every width, and named breakpoints at 768 and 1280 px. `useWidthClass` becomes the one owner of
three classes, `narrow`, `semi`, and `wide`. Four parts Astryx lacks are our own small components:
the titled `Pane`, the shell's column with its rail, the status line, and the palette's preview. The
shell replaces Astryx's `AppShell` and `SideNav` with that column on wide and semi-wide screens and
a bar of icon tabs on narrow ones. The home, settings, and decisions pages are rebuilt from `Pane`.
The server gains two fields: a session row's agent kind, and the week's usage. See the
[spec's architecture](spec.md#architecture).

Ownership: the theme owns every colour, font, and size; `theme.tsx` owns the scheme preference;
`useWidthClass` owns the classes; `shell/` owns what stays one tap away at each width and the
column's stored width; `statusHints.tsx` owns the hints a page declares; the server owns usage and
agent kinds. Pages never read breakpoints or colours themselves.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both. Its
approval comments, in [spec-review.md](spec-review.md), are carried out as
[Review comments](#review-comments) says.

## Review focus

1. **A browser that stored `"dark"` or `"light"`** reads as Mocha or Latte, and the settings show
   that scheme picked, not System. Task 6.
2. **A width crossing 1280 px** changes the shell only: a page keeps its place and its open pane,
   since pages lay out alike at semi-wide and wide. Task 3.
3. **The rail opened by keyboard focus** folds back when focus leaves it, and Tab reaches every row
   in it. Task 8.
4. **The column's stored width from Astryx's old key**, `astryx-resizable:uraeda.nav`, is read once
   and clamped to 220–480 px, so a human's width survives the upgrade. Task 8.
5. **A session row of an agent kind with no mark**, such as the fake agent's `fake`, gets the
   generic agent glyph, never an empty space. Task 7.
6. **A Claude report without a weekly window** keeps the 5 h window and shows no week, never "0%".
   Task 4.
7. **The palette opened while the list holds the keys**: `/` does nothing in a text field, and the
   list's ↑↓ do not move behind the open palette. Task 13.
8. **A deep link to `/settings/runs`** scrolls the form to its Runs section, so links in documents
   and tests keep working. Task 11.

## Global constraints

From the decisions this spec activates, word for word:

- [UI look](../decisions/ui-look.md): "The UI MUST look like a terminal tool: square corners, and
  content grouped in bordered panes whose title sits in their top border."
- "Text MUST be set for readability first: a monospace font by default, and a proportional font
  where it reads better, such as long prose."
- "A new colour scheme MUST be added as a named scheme of the same theme, never as styles in a
  view."
- "Every text colour MUST reach 4.5:1 against its background, and borders and controls 3:1, in every
  scheme. Checked by a test of the theme's tokens."
- "Text MUST be set at 120% of Astryx's base size, the size the human chose to read at."
- "Fonts MUST be bundled with the app under an open licence, and the UI MUST NOT load a file from
  another host."
- "A harness MUST be marked by Codicons' drawing of its mark where Codicons has one, and by a
  neutral glyph drawn for Uraeda otherwise."
- "Icons SHOULD come from Lucide, and another free set's glyph MAY stand in where it fits a concept
  clearly better."
- [UI layout](../decisions/ui-layout.md): "The UI MUST adapt to three width classes, narrow,
  semi-wide, and wide, not to the device, through the theme and never per-view media queries.
  Checked by the browser tests, at each class."
- "On narrow screens, views MUST be pages and menus and forms sheets; on wide screens, popovers and
  dialogs." "An open detail, tab, or sheet MUST be in the URL, so reload, Back, or a width change
  keeps it." "A column that takes room from the main content SHOULD be foldable and resizable."
- [Preview](../decisions/preview.md): "A spec's mockups and named states of views MUST be stories
  written with the real components, next to them." "An investigation MAY compare throwaway
  prototypes in any format, in its feature's `mockups` folder, and the approval of its spec deletes
  them."

From the active decisions the code touches, word for word:

- [UI components](../decisions/ui-components.md): "Views MUST use Astryx components wherever one
  fits the job, and be styled only through its theme, with no global stylesheet or inline styles."
  "Astryx, StyleX, and `@dnd-kit/react` MUST be pinned to exact versions." "A raw element MAY stand
  in for a missing Astryx component, with a reason, and the plan MUST list it as an Astryx gap."
- [UI behaviour](../decisions/ui-behaviour.md): "Every action MUST work by tap and by keyboard,
  never by hover alone." "Back and reload MUST keep the human's place and what they were reading."
  "Status MUST show next to what it concerns, and an error MUST stay there until dealt with, never
  only in a toast."
- [UI coherence](../decisions/ui-coherence.md): "A kind of information MUST be drawn by one shared
  component on every page that shows it." "Reading text MUST be drawn through `Prose`."
- [UI checks](../decisions/ui-checks.md): "UI tests MUST drive the UI as a user does, and MUST NOT
  assert markup, class names, or pixels." "Before handing over a UI change, the agent MUST review
  screenshots of every changed view at both sizes and in both themes against the decisions, and
  commit them."
- [Code quality](../decisions/code-quality.md): files at most 500 lines, functions 100, depth 4,
  parameters 7, by Oxlint; no new disable marker. A file at the limit is split first, in a
  `refactor` commit.
- [Problems](../decisions/problems.md): "Home and the sidebar's cards MUST show problems only, and
  notes MUST show only on their item's page."
- [Stack](../decisions/stack.md): "The web UI MUST draw workflow files from the core's document
  tree, never parsing their markdown."

Existing guarantees to keep: the shell's session search, the ＋ forms of the inbox and priorities,
the repository menu, renaming and archiving a session, the latest done items, the `[` key that folds
the column, the `]` key of the right column, and the list keys of
[`useListKeys`](/packages/web/src/lists/useListKeys.ts). Their tests in
[`shell.test.tsx`](/packages/web/src/__tests__/shell.test.tsx),
[`sidebar.test.tsx`](/packages/web/src/__tests__/sidebar.test.tsx), and
[`__browser__/sidebar.test.tsx`](/packages/web/src/__browser__/sidebar.test.tsx) change only their
landmarks and labels, never what they check.

## Code read

Facts from three maps of the code, read in full for this plan: the shell, the theme, and the pages.

- [`Shell.tsx`](/packages/web/src/Shell.tsx) (272 lines): Astryx `AppShell` and `SideNav`. Below 768
  px Astryx draws a top bar, "Mobile navigation", and a drawer behind "Open navigation". The width
  is stored by Astryx under `astryx-resizable:uraeda.nav` as `{size, isCollapsed}`, 280 px by
  default, 200–480 px.
- [`sidebar/`](/packages/web/src/sidebar/): `Sidebar.tsx` (385) draws Home, Needs you, Inbox and
  Priorities with ＋, Sessions with the 5 h window
  ([`Allowance.tsx`](/packages/web/src/sidebar/Allowance.tsx)); `cards.ts` holds the pure helpers
  `needsYou`, `byStatus`, `byStart`, `inFlight`, `toCard`; `DoneArea.tsx` measures the room left;
  nine components read Astryx's `useSideNavCollapse`.
- [`SidebarAdd.tsx`](/packages/web/src/SidebarAdd.tsx) and
  [`FeatureSettingsDialog.tsx`](/packages/web/src/sidebar/FeatureSettingsDialog.tsx) close the phone
  drawer with `useAppShellMobile` before opening a form.
- [`layout/useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts): `"narrow" | "wide"` at the
  theme's `md`. About 55 call sites in 40 files; nearly all mean "not narrow". The place keepers
  (`following.ts`, `useKeepPlace.ts`, `ProgressLine.tsx`, `App.tsx` `useListPosition`) compare
  classes.
- [`layout/SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx): the right column's
  `useResizable`, rail, easing, and `]` key: the pattern for the new left column.
- [`layout/TopBarSlot.tsx`](/packages/web/src/layout/TopBarSlot.tsx): one user, the round's answered
  count and Next, in `RoundNav.tsx`.
- [`routes.tsx`](/packages/web/src/routes.tsx): 479 lines, 21 from the limit. No `/sessions` page.
- [`theme/theme.ts`](/packages/web/src/theme/theme.ts) (194): extends the neutral theme; sizes grow
  1.2× from 1024 px only; two colour tuples; no fonts, radius, or breakpoints set. Built by
  `astryx theme build`, checked by the `web:theme` task. [`theme.tsx`](/packages/web/src/theme.tsx):
  `system | light | dark` under `uraeda.theme`. Astryx's `Theme` knows only light and dark.
- [`theme/icons.ts`](/packages/web/src/theme/icons.ts): about 53 `uraeda:*` icons drawn from Lucide
  without JSX, and `decisionIcon()`.
- [`__tests__/lint.test.ts`](/packages/web/src/__tests__/lint.test.ts): four allowed CSS imports,
  exact strings. `index.html` has no favicon; `packages/web` has no `public/`.
- [`home/HomeHub.tsx`](/packages/web/src/home/HomeHub.tsx) (348): tiles, Needs you with "Fix" rows
  for problems, Agents at work, Recently done at `#done`, Priorities Now/Next, Inbox, Decisions.
  [`labels.ts`](/packages/web/src/labels.ts) `waiting()` gives the verb and line.
- The server parses only the 5 h window:
  [`claude-events.ts`](/packages/server/src/runner/claude-events.ts) `usageEvents()` l.163-190, and
  [`usage.test.ts`](/packages/server/src/runner/__tests__/usage.test.ts) asserts a weekly window
  gives no report. `SessionRowRecord` in [`fate/views.ts`](/packages/server/src/fate/views.ts)
  l.231-248 has no agent.
- [`decisions/`](/packages/web/src/decisions/): `DecisionsPage.tsx` uses
  [`layout/Panes.tsx`](/packages/web/src/layout/Panes.tsx) (detail 40%, shared with the inbox and
  priorities); no reader at `/decisions`; `PrincipleDetail` shows one principle;
  `BranchDecision.tsx` draws a branch's change with `spec/DecisionCard.tsx`. A decision's `summary`
  is its intent's first sentence. No command palette exists; Astryx's `CommandPalette` has no
  preview slot.
- [`settings/`](/packages/web/src/settings/): a category index beside one category; `categories.ts`
  has the six categories and `searchSettings()`; "No setting matches “…”." already exists;
  `FileProblem` shows an unreadable file.
- Tests: happy-dom in `__tests__/` through `renderPage`, default width 1024 (`atWidth`, helpers
  l.86); browser tests in `__browser__/` at a 402×874 phone and a 1440×900 desktop, with
  `checkLayout` (axe AA in both schemes) and `checkTextSizes` (17 px under 1024, 19 px from 1024).
  23 test files name "Side navigation", "Open navigation", or "Mobile navigation".
- Commands: `nix develop -c vp run fast` after each task; one happy-dom file with
  `nix develop -c vp test --project uraeda-web <file>`; one browser file with
  `nix develop -c vp test --project desktop <file>` or `--project phone`; everything with
  `nix develop -c vp run ready`, before every push.

## Constitution check

| I. Humans stay in control | II. Git and plain text first | III. Asynchronous by default | IV. Review effort matches impact | V. Tools are optional | VI. Code is checked and stays maintainable |
| ------------------------- | ---------------------------- | ---------------------------- | -------------------------------- | --------------------- | ------------------------------------------ |
| ✅                        | ✅                           | ✅                           | ✅                               | ✅                    | ✅                                         |

## Complexity tracking

| Abstraction or exception                     | Why it is needed                                              | Simpler alternative rejected because                         |
| -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| `Pane` (Astryx gap)                          | The UI look's titled border, on every view                    | Astryx's `Card` and `Section` have no title in the border    |
| `shell/` column, rail, and tabs (Astryx gap) | Three widths, a rail that opens over the page by focus or tap | `SideNav` folds to icons but cannot open over the page       |
| `sidebar/CardRow.tsx` (Astryx gap)           | A card's whole name, wrapping, with its step under it         | `SideNavItem` takes a one-line label, cut by an ellipsis     |
| `StatusLine` and `statusHints.tsx`           | Pages declare the keys that work; the shell draws them once   | Each page drawing its own hints breaks UI coherence          |
| `JumpPalette` preview (Astryx gap)           | The decisions palette previews the entry under the cursor     | `CommandPalette` has no preview slot                         |
| `HarnessMark`                                | One mark per agent kind, on every session row                 | Names alone were the spec's rejected option                  |
| `routes.tsx` split                           | Adding `/sessions` passes the 500-line limit                  | Growing the file needs a new disable marker                  |
| Three width classes in `useWidthClass`       | The decision's semi-wide class                                | A second hook for the shell would be two homes for the width |

## Review comments

From [spec-review.md](spec-review.md):

- **C1** (the scheme rule of the UI look): carried out in the approval commit: the rule is gone.
  Mocha, Latte, and System stay what the spec builds. Task 6.
- **C2** (Lucide as a SHOULD): carried out in the approval commit: "Icons SHOULD come from Lucide".
- **C3** (the logo rule): carried out in the approval commit: the rule is gone. The logo is still
  the dot-matrix tree of the spec's US1. Task 7.
- **C4** ("Just do the form, not the file style"): supersedes US5's Form and File switch, its
  scenario 2, and the two file-view edge cases. Settings is the form only. Task 11.
- After approving, the human asked that "the decision should allow for fonts that are NOT
  monospaced", with readability first: the UI look now says so, and Task 2 sets prose in Inter.

## Test map

Happy-dom tests render `<App>` through `renderPage` against the server in process, on the fixture
repository and the fake agent, at 1440 px unless a test sets `atWidth`. Browser tests run the real
app in WebKit through the test server, at the phone and the desktop size, and at 1205 px where a
test sets `page.viewport(1205, 900)`; `checkLayout` checks text sizes, measure, and axe in both
schemes. The theme's contrast test reads the built theme's tokens.

| Spec                                                                             | Task     | Test                                                                                                                                                                            |
| -------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| US1 1, 2; more 1; Review focus: stored dark or light                             | 6        | `__tests__/theme.test.tsx`: System follows the system; Latte stays after a reload; a stored `"dark"` reads as Mocha                                                             |
| US1 3; Review focus: a kind with no mark                                         | 7        | `__tests__/sidebar.test.tsx`: a Claude Code session has the Claude mark, the fake agent's the generic glyph                                                                     |
| US1 more 2; SC-002                                                               | 2        | `__browser__/offline.test.tsx`: no request leaves the test server's host while the home loads; `__tests__/offline-build.test.ts`: the built app loads nothing from another host |
| SC-001                                                                           | 2        | `__tests__/theme-tokens.test.ts`: every text token 4.5:1, borders 3:1, in both schemes                                                                                          |
| US1 look (120%, mono, square)                                                    | 2        | `__browser__/layout.test.tsx` `checkTextSizes`, and a token test of the scale and radii                                                                                         |
| US2 1; SC-003                                                                    | 8        | `__browser__/shell.test.tsx`: at 1205 px the rail is 52 px; focus, hover, and a tap on the logo open it                                                                         |
| US2 2; Review focus: old stored width                                            | 8        | `__browser__/shell.test.tsx`: at 1900 px the column is 266 px; a drag to 320 px stays after reload; an old Astryx width is kept                                                 |
| US2 3                                                                            | 8        | `__tests__/shell.test.tsx`: at 390 px the Sessions tab's badge reads 3 and opens `/sessions`                                                                                    |
| US2 more 1; Review focus: focus leaves the rail                                  | 8        | `__browser__/shell.test.tsx`: Escape, or focus or pointer leaving, folds it                                                                                                     |
| US2 more 2                                                                       | 9        | `__tests__/status-line.test.tsx`: the feature in Needs you, "1 need you" in the status line                                                                                     |
| Edge: the rail on a touch screen                                                 | 8        | `__browser__/shell.test.tsx` (phone project with a 1205 px viewport): a tap opens, a tap outside folds                                                                          |
| Edge: the column dragged past its limits                                         | 8        | `__browser__/shell.test.tsx`: it stops at 220 and 480 px                                                                                                                        |
| Edge: crossing 1280 with the rail open; Review focus: a crossing keeps the place | 3, 8     | `__browser__/layout.test.tsx`: crossing 1280 keeps the page's scroll and pane; `__browser__/shell.test.tsx`: the rail becomes the column                                        |
| US3 1, more 1                                                                    | 10       | `__tests__/home.test.tsx`: Problems first only when a spec lacks a section                                                                                                      |
| US3 2; SC-003                                                                    | 10       | `__browser__/home.test.tsx`: at 1205 px In progress and Sessions sit side by side, widgets in two columns                                                                       |
| US3 3                                                                            | 10       | `__tests__/home.test.tsx`: the full title, "Questions" with the round's size, and "Answer"                                                                                      |
| US3 more 2                                                                       | 10       | `__tests__/home.test.tsx`: at 402 px one column in the same order                                                                                                               |
| US3 usage; Review focus: no weekly window                                        | 4, 10    | `server usage.test.ts`: a weekly window reports; none reports no week. `home.test.tsx`: the Usage pane                                                                          |
| US4 1, 2                                                                         | 12       | `__tests__/decisions.test.tsx`: the reader shows the constitution at `/decisions`; "UI layout" opens at `/decisions/ui-layout`                                                  |
| US4 3; SC-005; Review focus: the palette and the list keys                       | 13       | `__browser__/decisions.test.tsx`: `/`, "noti", Notifications with its intent and rules; Enter opens it                                                                          |
| Edge: the palette matches nothing                                                | 13       | `__tests__/palette.test.tsx`: "Nothing matches."                                                                                                                                |
| US4 more 1                                                                       | 12       | `__tests__/decisions.test.tsx` at 402 px: the reader replaces the list, with the way back                                                                                       |
| US4 more 2                                                                       | 12       | `__tests__/decisions.test.tsx`: a decision changed on a feature's branch shows its diff first                                                                                   |
| US5 1; more 1; Review focus: deep link                                           | 11       | `__tests__/settings.test.tsx`: "port" shows the Port row alone; "zzz" says so; `/settings/runs` scrolls to Runs                                                                 |
| Edge: `settings.toml` missing or invalid                                         | 11       | `__tests__/settings.test.tsx`: the Server and Runs sections show the file's problem                                                                                             |
| Edge: unknown harness                                                            | 7        | `__tests__/harness-mark.test.tsx`: an unknown kind draws the generic glyph                                                                                                      |
| SC-004                                                                           | 5, 10–12 | Review, against the stories: every bordered group is `Pane`                                                                                                                     |
| US6 1, 2                                                                         | 14       | Review of the skill's text; `ura check` on the example passes                                                                                                                   |
| Three classes in the browser tests                                               | 3        | `__browser__/helpers.tsx` `atSize("semi")`, used by the shell and home tests                                                                                                    |

## Waves

1. Task 1, alone: the Astryx upgrade touches the lockfile and every view.
2. Tasks 2, 4, 5: the theme, the server's two fields, and the skill. They share no file.
3. Tasks 3, 6, 7: the width classes, the scheme preference, and the shared marks. Task 3 changes the
   width's consumers; 6 changes `theme.tsx` and Appearance; 7 adds `Pane`, `Logo`, `HarnessMark`,
   and icons. Shared: `__tests__/helpers.tsx` (Task 3 only), `icons.ts` (Task 7 only).
4. Task 8, alone: the shell.
5. Task 9, alone: the status line, inside the shell.
6. Tasks 10, 11, 12: the home, settings, and decisions pages, each in its own folder. Each adds its
   own hints to `statusHints.tsx`'s registry of page hints, side by side.
7. Task 13: the palette, on the decisions page.
8. Task 14: the stories, the screenshots, the skill's example check, and the prototypes' removal.

---

## Task 1: Astryx 0.7.3, and the palette's preview checked

**Risky:** an upgrade of the component library under every view, and the check of the outside
behaviour the spec marks unverified.

**Files:**

- Modify: `packages/web/package.json` (`@astryxdesign/core`, `@astryxdesign/theme-neutral`,
  `@astryxdesign/cli` to `0.7.3`), `pnpm-lock.yaml`, `pnpm-workspace.yaml` (the stale
  `minimumReleaseAgeExclude` entry for 0.6.7 replaced by the three exact 0.7.3 versions, published
  the day before)
- Modify: whatever `astryx upgrade --from 0.6.8 --apply --path packages/web` and its codemods
  change; `src/theme/theme.ts` (`--color-selection-edge` gets a fallback for the moved data tokens);
  `src/theme/built/*` rebuilt
- Create: `packages/web/src/__browser__/palette-check.test.tsx`
- Modify (what 0.7 broke, R2 and R3): `src/Blocks.tsx` (a document's list `edge="flush"`),
  `src/SettledGroups.tsx` and `src/RepositoryMenu.tsx` (text the touch type cut on the phone),
  `__tests__/pane.test.tsx`, `__tests__/session.test.tsx`, `__focused__/composer.test.tsx` (a Banner
  has no role, and Astryx's announcer repeats a text), `__browser__/session-look.test.tsx` (a
  message's code block wraps)

**Interfaces:**

- Produces: Astryx 0.7.3 everywhere; the finding of the check, as [R1](rulings.md): `renderItem`'s
  `isSelected` is the picker's value, never the highlight, but the palette's public context,
  `useCommandPaletteContext()`, reports it to a slot, which can also highlight the first result, so
  Task 13 keeps `CommandPalette`.

- [x] **Step 1: Write the check of the palette**: render Astryx's `CommandPalette` with three items
      and a footer that previews the highlighted item, read from `useCommandPaletteContext()`
      (`renderItem`'s `isSelected` never reported it, R1). Assert: ↓ previews the first item, ↓
      again the second; with the footer highlighting the first result, typing "thi" previews the
      third and Enter picks it. Break it catches: a palette that reports no highlight, so no preview
      can follow the cursor.
- [x] **Step 2: Run the whole validation before the upgrade**: `nix develop -c vp run ready`.
      Expected: PASS, the baseline.
- [x] **Step 3: Upgrade**: set the three packages to `0.7.3`, `nix develop -c vp install`, run
      `nix develop -c pnpm --filter uraeda-web exec astryx upgrade --from 0.6.8 --apply --path .`,
      then `nix develop -c vp run --filter uraeda-web theme`. Fix what the 0.7.0 changes break:
      Banner roles (tests that find a Banner by role `status` or `alert` read its text instead), the
      theme's data tokens, and inputs' root `xstyle`.
- [x] **Step 4: Run the palette check**:
      `nix develop -c vp test --project desktop src/__browser__/palette-check.test.tsx`. Expected:
      PASS, or a failure that Task 13's fallback covers; write the ruling either way.
- [x] **Step 5: Run the whole validation**: `nix develop -c vp run ready`. Expected: PASS.
- [ ] **Step 6: Commit**:
      `git add -A packages/web pnpm-lock.yaml pnpm-workspace.yaml specs/2026-10-20-layout-look` and
      `git commit -m "build(layout-look): Astryx 0.7.3, and its palette's highlight checked"`.

## Task 2: The theme: Catppuccin, the fonts, square, 120%

**Files:**

- Modify: `packages/web/src/theme/theme.ts`, `src/theme/built/*` (rebuilt)
- Modify: `packages/web/src/main.tsx`, `.storybook/preview.tsx`, `src/__browser__/helpers.tsx` (font
  imports; `checkTextSizes`), `src/__tests__/lint.test.ts` (allowed CSS imports)
- Modify: `packages/web/src/Prose.tsx` (the reading font), `packages/web/package.json`
  (`@fontsource-variable/jetbrains-mono` `5.3.0`, `@fontsource-variable/inter` `5.3.0`, exact)
- Create: `packages/web/src/__tests__/theme-tokens.test.ts`, `src/__browser__/offline.test.tsx`
- Modify: `README.md` (credits: JetBrains Mono and Inter, SIL OFL)
- Modify (what the wider text moved, R5): `src/ReviewVerdict.tsx`, `src/pane/PriorityPane.tsx`,
  `src/Shell.tsx`, `src/ChangeAside.tsx`, `src/__tests__/commit-actions.test.tsx`,
  `src/__browser__/spec.test.tsx`, `src/__browser__/layout.test.tsx`,
  `src/__browser__/sizes.test.tsx`

**Interfaces:**

- Produces: the tokens every later task uses: the neutral colour names
  (`--color-background-body/surface/card/muted`, `--color-text-*`, `--color-border*`,
  `--color-accent`, `--color-*-muted`) now hold Catppuccin Latte in the light slot and Mocha in the
  dark one; a local `--color-text-lavender`; `--font-family-reading` (Inter) for prose; radii 0; the
  breakpoints `md` 768 and `xl` 1280, named in the theme.

- [x] **Step 1: Write the failing tests.** `theme-tokens.test.ts`, table-driven over both slots of
      `uraedaTheme`'s tokens: each `--color-text-*` against `--color-background-body`, `-surface`,
      and `-card` reaches 4.5:1; `--color-border`, `--color-border-emphasized`, and each control
      colour reach 3:1 against `--color-background-surface` and `-body`. A second test: the radii
      are `0px`, and the body font size is `16.8px` (14 × 1.2) without any width rule. Break:
      Catppuccin's stock Latte accents, which read 3.0:1 as text. `offline.test.tsx`: load the home,
      wait for it to draw, and assert every request the page made went to the page's own origin;
      `offline-build.test.ts` reads the built app, `packages/web/dist`, for a link, import, or font
      from another host. Break: a font loaded from Google Fonts.
- [x] **Step 2: Run them to check they fail**:
      `nix develop -c vp test --project uraeda-web src/__tests__/theme-tokens.test.ts`. Expected:
      FAIL, the radius is not `0px`.
- [x] **Step 3: Implement the theme.** Tokens as `[latte, mocha]` pairs from the mockup's palette,
      [`terminal-2/style.css`](mockups/terminal-2/style.css) `:root` and `[data-theme="latte"]`:
      Latte's accents as text use the mockup's darker steps. The dim text is `#5f6276` and `#969db8`
      (R4). Typography: body, heading, and code in "JetBrains Mono Variable";
      `--font-family-reading` "Inter Variable", used by `Prose` for its reading text. Sizes: the
      1.2× growth moves out of the 1024 px rule into the base; the reading size is 19 px at every
      width. Radii: `--radius-inner/-element/-container/-page` `0px`, and `--radius-full` `0px`
      where squares read well (switches, badges); dots stay round. Shadows flat. Breakpoints
      `md: 768`, `xl: 1280`. Import both Fontsource `index.css` files in `main.tsx`, the Storybook
      preview, and the browser helpers, and allow their exact specifiers in the lint test.
      `checkTextSizes` expects 19 px at every width.
- [x] **Step 4: Rebuild and run**: `nix develop -c vp run --filter uraeda-web theme`, then the two
      new tests. Expected: PASS.
- [x] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, then
      `nix develop -c vp test --project desktop src/__browser__/layout.test.tsx` and
      `--project phone` on the same file. Expected: PASS. Deferred to ready: the other browser
      files.
- [x] **Step 6: Commit**:
      `git commit -m "feat(layout-look): the terminal theme, Catppuccin, mono, and square"`.

## Task 3: Three width classes

**Files:**

- Create: `packages/web/src/routeHistory.ts` (a `refactor` commit first: the history helpers of
  `routes.tsx`, `navigate`, `redirect`, `currentEntry`, `updateEntry`, `useRestoreScroll`,
  `useRestorePaneScroll`, moved as they are)
- Modify: `packages/web/src/layout/useWidthClass.ts` and every consumer
- Modify: `packages/web/src/__tests__/helpers.tsx` (default width 1440),
  `src/__browser__/helpers.tsx` (`atSize("semi")`: the desktop instance narrowed to 1205×900 for the
  scope's tests, R9)

**Interfaces:**

- Produces: `type WidthClass = "narrow" | "semi" | "wide"`; `useWidthClass(): WidthClass` and
  `widthClassNow(): WidthClass`, from the theme's `md` and `xl`; `isNarrow(c: WidthClass): boolean`.
  Pages that laid out "wide" now test `!isNarrow(...)`; only the shell, the home, and the decisions
  page read `semi` itself.

- [x] **Step 1: Structural step**: move the history helpers out of `routes.tsx` into
      `routeHistory.ts`, re-exported from `routes.tsx`, so no caller changes. Run
      `nix develop -c vp run fast`, commit
      `refactor(layout-look): the route history in its own module`.
- [x] **Step 2: Write the failing tests**: in `__tests__/width-class.test.tsx`, table-driven: 767 →
      narrow, 768 → semi, 1279 → semi, 1280 → wide. In `__browser__/layout.test.tsx`: at 1205 px
      open a task in the priorities' pane, scroll the list, resize to 1440 px, and assert the pane
      and the scroll stayed. Break: a place keeper that treats the 1280 crossing like 768.
- [x] **Step 3: Run them to check they fail**: Expected: FAIL, 768 reads `wide`.
- [x] **Step 4: Implement**: the three classes; each consumer's `=== "wide"` becomes
      `!isNarrow(...)`; the place keepers compare `isNarrow` only. The happy-dom default width
      becomes 1440, so tests keep today's wide shell; the browser helper's `atSize` accepts
      `"semi"`.
- [x] **Step 5: Run the task's validation**: `nix develop -c vp run fast`, then
      `nix develop -c vp test --project uraeda-web`. Expected: PASS. Deferred to ready: browser
      files.
- [x] **Step 6: Commit**: `git commit -m "feat(layout-look): three width classes"`.

## Task 4: The server: a session row's agent, and the week's usage

**Files:**

- Modify: `packages/server/src/runner/events.ts`, `runner/claude-events.ts` (`usageEvents`),
  `runner/processes.ts`, `runner/sessions.ts` (`status`), `fate/views.ts` (`SessionRowRecord.agent`,
  `AgentRecord.weekLimit`), `fate/sessions.ts` (the rows), `packages/web/src/views.ts` (select
  `weekLimit`; rows are selected whole, so `agent` comes with them:
  [R7](rulings.md#r7-the-session-rows-agent-needs-no-web-selection)),
  `packages/benchmarks/src/session.ts` (a full week is a usage limit too:
  [R6](rulings.md#r6-a-weekly-window-now-gives-the-week-where-it-gave-no-report))
- Modify: `packages/server/src/runner/__tests__/usage.test.ts`, `claude.test.ts`,
  `runner/__tests__/sessions.test.ts`, `src/__tests__/sessions.test.ts`,
  `packages/web/src/__focused__/helpers.tsx`, `fixtures/claude/ignored.jsonl` (its report gains a
  `seven_day` window)

**Interfaces:**

- Produces: `SessionRowRecord.agent: string` (the adapter's kind, `"claude"` or `"fake"`);
  `AgentRecord.weekLimit: { percentUsed: number; resetsAt: string } | null`, beside `fiveHourLimit`;
  the usage event `{ fiveHour?: UsageLimit; week?: UsageLimit; type: "usage" }`, never neither.

- [x] **Step 1: Write the failing tests**: `usage.test.ts`: a report with `five_hour` and
      `seven_day` gives both; one with `five_hour` alone gives no week; a malformed `seven_day`
      gives no week and keeps the 5 h window. The existing "weekly gives no report" case changes,
      since the spec asks for the week: write the ruling. A sessions test: a session row carries its
      agent's kind. Break: a week read from the 5 h window's numbers.
- [x] **Step 2: Run them to check they fail**:
      `nix develop -c vp test --project uraeda-server src/runner/__tests__/usage.test.ts`. Expected:
      FAIL, no `week` in the event.
- [x] **Step 3: Implement** the parsing, the store of the freshest unexpired report per process for
      each window, and the two fields.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`. Expected: PASS.
- [x] **Step 5: Commit**:
      `git commit -m "feat(layout-look): a session row's agent, and the week's usage"`.

## Task 5: Prototypes in an investigation, in the skill

**Files:**

- Modify: `skills/uraeda/references/discovery.md` (visual questions: throwaway prototypes in
  `mockups/`, any format), `skills/uraeda/references/spec.md` (Mockups: the spec's mockups stay
  stories; the prototypes are deleted at approval), `skills/uraeda/references/approval.md` (delete
  the feature's prototypes in the approval commit, keeping the spec's stories),
  `skills/uraeda/references/plan.md` (the plan step deletes them when the approval step does not
  run), `skills/uraeda/SKILL.md` and `assets/templates/specs/README.md` (`mockups/` holds them)

**Interfaces:**

- Produces: nothing later tasks consume.

- [x] **Step 1: Edit the three references** so a discovery may link HTML or image prototypes in
      `mockups/`, and the approval step deletes them in its commit. Match the preview decision's
      rule word for word where it is quoted.
- [x] **Step 2: Run the checks**: `nix develop -c vp run fast` and
      `~/.cargo/bin/ura check skills/uraeda/assets/example/specs`. Expected: PASS, no problem.
- [x] **Step 3: Commit**:
      `git commit -m "docs(layout-look): prototypes in an investigation, deleted at approval"`.

## Task 6: Mocha, Latte, or System

**Files:**

- Modify: `packages/web/src/theme.tsx`, `src/settings/OtherSettings.tsx` (`AppearanceSettings`)
- Modify: `packages/web/src/__tests__/theme.test.tsx`, and `src/__browser__/story-embed.test.tsx`,
  whose helper picks a scheme in the control; browser tests writing `uraeda.theme` as `"dark"` or
  `"light"` keep working through the legacy reading

**Interfaces:**

- Produces: `type Scheme = "system" | "mocha" | "latte"`;
  `useScheme(): [Scheme, (s: Scheme) => void]`; `ThemeModeProvider` still resolves to Astryx's
  `"light" | "dark"` (Latte, Mocha). `ThemeMode` keeps `"system"` for the Storybook preview.

- [x] **Step 1: Write the failing tests** in `theme.test.tsx`: the Appearance "Colour scheme"
      control offers Mocha, Latte, and System, System picked by default; picking Latte stores
      `"latte"` and draws the light slot after a reload, whatever the system; a stored `"dark"`
      shows Mocha picked and draws the dark slot; a stored `"light"` shows Latte. Break: a legacy
      value read as System.
- [x] **Step 2: Run them to check they fail**. Expected: FAIL, no "Colour scheme" control.
- [x] **Step 3: Implement** the scheme, the legacy reading, and the rewrite at the next pick, as
      [the data model](data-model.md) says.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast` and
      `nix develop -c vp test --project uraeda-web src/__tests__/theme.test.tsx`. Expected: PASS.
- [x] **Step 5: Commit**: `git commit -m "feat(layout-look): Mocha, Latte, or the system's"`.

## Task 7: The pane, the logo, and the harness marks

**Files:**

- Create: `packages/web/src/layout/Pane.tsx`, `src/Logo.tsx`, `src/HarnessMark.tsx`,
  `packages/web/public/favicon.svg`
- Modify: `packages/web/index.html` (the favicon), `src/theme/icons.ts` (Codicons' `claude` and
  `openai`, with the CC BY 4.0 attribution in a comment; a generic agent glyph from Lucide's `bot`),
  `src/sidebar/ItemCard.tsx` (`KindIcon`: a session's mark), `src/SessionHeader.tsx`,
  `src/sidebar/cards.ts`, `README.md` (credits: Codicons, CC BY 4.0)
- Create first, in a `refactor` commit: `src/theme/lucide.ts`, Lucide's glyphs moved out of
  `icons.ts`, which would pass 500 lines (R11)
- Create: `packages/web/src/__tests__/harness-mark.test.tsx`

**Interfaces:**

- Consumes: `SessionRowRecord.agent` from Task 4.
- Produces:
  `Pane({ title, icon?, count?, isActive?, tone?: "attention" | "problem", level?, children, id? })`:
  a `section` labelled by its title, drawn with the title, a heading at `level` (2 by default), in
  the top border; the accent border when `isActive`. `Logo({ size?: "sm" | "md" | "lg" })`: the 8×8
  dot tree, `aria-label="Uraeda"`. `HarnessMark({ kind, size?, isDecorative? })` and
  `harnessMark(kind)`: Codicons' mark for `claude` and `codex`, Lucide's `bot` otherwise, with the
  harness's name as its accessible name, silent where its name is already said (R10).

- [x] **Step 1: Write the failing tests**: `harness-mark.test.tsx` table-driven: `claude` → "Claude
      Code" with the Codicons mark, `codex` → "Codex" with the OpenAI mark, `fake` and `pi` → the
      generic glyph with their names. In `sidebar.test.tsx`: a session row names its harness. Break:
      an unknown kind drawing nothing.
- [x] **Step 2: Run them to check they fail**. Expected: FAIL, no `HarnessMark`.
- [x] **Step 3: Implement** the three components; `Pane` is a raw `section` with StyleX on tokens
      (an Astryx gap: no titled border), its title a heading at the level the caller gives.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast` and the two test files.
      Expected: PASS.
- [x] **Step 5: Commit**:
      `git commit -m "feat(layout-look): the pane, the dot-tree logo, and the harness marks"`.

## Task 8: The shell: a column, a rail, and tabs

**Risky:** it replaces the navigation of every page, and the stored width.

**Files:**

- Create: `packages/web/src/shell/Column.tsx` (the frame, the resize, the fold),
  `shell/ColumnPanes.tsx` (the heading, New and Note, Navigate, the foot), `shell/ShellPanes.tsx`
  (Needs you, Sessions, In progress, Done), `shell/fold.ts` (`useColumnFold`), `shell/Rail.tsx` (the
  52 px rail and its overlay), `shell/Tabs.tsx` (the narrow tabs), `shell/columnWidth.ts` (the
  stored width), `shell/SessionsPage.tsx` (`/sessions`, the narrow tab's page),
  `sidebar/CardRow.tsx` (a card's row, its whole name wrapping and its step under it, R17),
  `routeTable.ts` (the route table, imported by the routes and the history, R13)
- Modify: `packages/web/src/Shell.tsx` (no `AppShell`, no `SideNav`), `src/sidebar/*` (the rows as
  pane content; `useSideNavCollapse` replaced by the shell's own fold state; `Sidebar.tsx` split
  into `Cards.tsx` and `entries.ts`; `SidebarHeading.tsx` removed), `src/SidebarAdd.tsx` and
  `sidebar/FeatureSettingsDialog.tsx` (no drawer to close), `src/routes.tsx` (`/sessions`),
  `src/App.tsx`, `src/RepositoryMenu.tsx` (the logo in its trigger), `src/layout/Pane.tsx`
  (`isGroup`), `src/theme/` (the rail's sizes, its icons, R19), `src/QuestionCard.tsx` (R19)
- Modify: every test naming "Side navigation", "Open navigation", or "Mobile navigation"; create
  `src/__browser__/shell.test.tsx`, and a `tap` command in `vite.browser.config.ts`

**Interfaces:**

- Consumes: `useWidthClass` (Task 3), `Pane`, `Logo`, `HarnessMark` (Task 7).
- Produces: the landmarks `navigation` "Navigation" (column or rail) and `navigation` "Tabs"
  (narrow), the panes inside them `group`s (R14);
  `useColumnFold(): { isFolded: boolean; toggle(): void }` for the `[` key; the route `sessions`;
  `ShellPanes` (Needs you, Sessions, In progress, Done) used by the column and by `/sessions`;
  `entries.ts`'s `runningSessions` and `nowCount`.

- [x] **Step 1: Write the failing tests.** `__browser__/shell.test.tsx`: at 1205 px the navigation
      is 52 px wide; hover, Tab into it, or a tap on the logo opens it to its full width over the
      page; Escape, focus leaving, or the pointer leaving folds it; at 1900 px it is 266 px; a drag
      to 320 px stays after a reload; a drag past the limits stops at 220 and 480; an old
      `astryx-resizable:uraeda.nav` width of 300 is kept. Phone project at 1205 px: a tap on the
      logo opens, a tap outside folds. `__tests__/shell.test.tsx` at 390 px: the Tabs hold Home,
      Inbox, Priorities, Sessions, Decisions, Settings, and New; with 3 running sessions the
      Sessions tab's badge reads 3, and a tap opens `/sessions`. The existing shell and sidebar
      tests move to the new landmarks. Break: a rail that opens on hover only.
- [x] **Step 2: Run them to check they fail**:
      `nix develop -c vp test --project desktop src/__browser__/shell.test.tsx`. Expected: FAIL, no
      landmark "Navigation".
- [x] **Step 3: Implement.** The column's panes, top to bottom: the logo with the repository menu,
      New and Note, the session search, Navigate (Home, Inbox with ＋ and its count, Priorities
      with ＋ and its count, Decisions), Needs you, Sessions, In progress, Done, and at its foot the
      5 h window and Settings. Width: 14% of the window between 256 and 340 px until dragged, then
      the stored width, 220–480 px, under `uraeda.nav`. `[` folds the wide column to the rail. Tabs:
      icon buttons with badges (inbox count; running sessions on Sessions), the page's own name as
      each tab's label.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, then the shell, sidebar,
      and layout files in both browser projects. Expected: PASS.
- [x] **Step 5: Commit**: `git commit -m "feat(layout-look): the shell's column, rail, and tabs"`.

## Task 9: The status line

**Files:**

- Create: `packages/web/src/shell/StatusLine.tsx`, `src/statusHints.tsx`,
  `src/__tests__/status-line.test.tsx`
- Modify: `packages/web/src/Shell.tsx`, `src/layout/TopBarSlot.tsx` (its slot drawn in the status
  line), `src/lists/useListKeys.ts`, `src/RoundNav.tsx`, and `src/shell/Column.tsx` (declare their
  hints), `src/QuestionCard.tsx` (its sticky header one row under the top, R20),
  `src/layout/Overlay.tsx` (a sheet that is no modal covers the line),
  `src/__tests__/round.test.tsx`, `src/__browser__/storybook-page.test.tsx`, and
  `src/__browser__/side-column.test.tsx` (the status line at the window's bottom, R20)

**Interfaces:**

- Produces: `useStatusHints(hints: ReadonlyArray<{ keys: string; label: string }>)`: a page or list
  declares the keys that work while it shows; `StatusLine`: the hints, the slot, then "N need you"
  and the running count.

- [x] **Step 1: Write the failing tests**: on the priorities, the status line reads "j k move", "⏎
      open", "esc close"; on a round at 1440 px, "n p unanswered"; with one feature waiting, "1 need
      you"; on the home, no list hints. Break: hints left over from the page before.
- [x] **Step 2: Run them to check they fail**. Expected: FAIL, no status line.
- [x] **Step 3: Implement** the registry, the line under the page at every width, and the slot.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast` and the round's browser
      file. Expected: PASS.
- [x] **Step 5: Commit**: `git commit -m "feat(layout-look): a status line of the keys that work"`.

## Task 10: The home, core then overview

**Files:**

- Modify: `packages/web/src/home/HomeHub.tsx`, `home/parts.tsx`, `home/summary.ts`,
  `home/features.ts`, `src/Home.tsx`, `src/labels.ts` (a gate's short name),
  `src/sidebar/CardRow.tsx` (its link a `RouterAnchor`, its "…" optional)
- Create: `packages/web/src/home/Core.tsx`, `home/Usage.tsx`, `home/Recent.tsx`,
  `src/__browser__/home.test.tsx`
- Modify: `packages/web/src/__tests__/home.test.tsx`, and the tests that read home's old cards
  (R23). `src/sidebar/DoneArea.tsx` is unchanged: its "…" link keeps `/#done`, now the Recent pane

**Interfaces:**

- Consumes: `Pane` (Task 7), `AgentRecord.weekLimit` (Task 4), `useWidthClass` (Task 3).

- [x] **Step 1: Write the failing tests** in `home.test.tsx`: with a spec lacking a required
      section, the first pane is "Problems", naming it, above "Needs you"; without, Needs you is
      first; "Layout and look and feel"'s row shows its full title, "Questions", the round's waiting
      line, and "Answer"; In progress and Sessions follow, then a separator "Overview", then
      Priorities now, Usage (5 h and week), Inbox (3 latest notes), and Recent (done items,
      `id="done"`); at 402 px the same order in one column. `__browser__/home.test.tsx` at 1205 px:
      In progress and Sessions side by side, the widgets in two columns. Break: Problems drawn as
      Needs you rows, as today.
- [x] **Step 2: Run them to check they fail**. Expected: FAIL, no "Problems" pane.
- [x] **Step 3: Implement** the home from `Pane`, centred on `Page`; the widgets wrap in two columns
      from semi-wide.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast`, the two home files.
      Expected: PASS.
- [x] **Step 5: Commit**: `git commit -m "feat(layout-look): the home, core then overview"`.

## Task 11: Settings on one page

**Files:**

- Create: `packages/web/src/settings/SettingRow.tsx` (a row: icon, name, help, control)
- Modify: `packages/web/src/settings/SettingsView.tsx`, `settings/categories.ts` (each setting's
  icon and help line), `ServerSettings.tsx`, `RunSettings.tsx`, `OtherSettings.tsx`,
  `SettingsPage.tsx`, `SettingsView.stories.tsx`, `theme/icons.ts` and `theme/lucide.ts` (the rows'
  glyphs), `scripts/settings-shots.ts`
- Modify: `packages/web/src/__tests__/settings.test.tsx`, `__browser__/layout.test.tsx` (the
  settings pages' waits), `__browser__/story-embed.test.tsx` (the scheme picked on the form)

**Interfaces:**

- Consumes: `Pane`, the scheme control (Task 6).

- [x] **Step 1: Write the failing tests**: one form with the sections Server, Appearance, Sign-in,
      Agents, Runs, and Reviews in that order; "port" in "Search settings" leaves only the Port row,
      under Server; "zzz" reads "No setting matches “zzz”."; `/settings/runs` shows the form with
      Runs in view; with an invalid `settings.toml`, Server and Runs show the file's problem. The
      server mutation tests keep their controls. Break: a search that filters sections, not rows.
- [x] **Step 2: Run them to check they fail**. Expected: FAIL, the categories index is there.
- [x] **Step 3: Implement** the form; no file view (the review's C4).
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast` and the settings file.
      Expected: PASS.
- [x] **Step 5: Commit**: `git commit -m "feat(layout-look): settings on one page, with a search"`.

## Task 12: Decisions in three columns

**Files:**

- Modify: `packages/web/src/decisions/DecisionsPage.tsx`, `DecisionList.tsx`,
  `ConstitutionRegion.tsx`, `DecisionDetail.tsx`, `src/layout/Panes.tsx` (a list share for the
  decisions, `listWidth`), `src/App.tsx` (`/decisions` opens the reader), `src/theme/theme.ts`
  (`--size-ledger-list`)
- Create: `packages/web/src/decisions/ConstitutionReader.tsx`, `decisions/BranchChange.tsx` (with
  `useBranchChange`, R26)
- Modify: `packages/web/src/__tests__/decisions.test.tsx`, `__tests__/decision-rules.test.tsx`,
  `__browser__/decisions.test.tsx`; `__browser__/layout.test.tsx`'s waits still hold

**Interfaces:**

- Consumes: `Pane` with `isActive` (Task 7), `useStatusHints` (Task 9).
- Produces: `DecisionsPage` with a reader always open on wide and semi-wide screens; the
  constitution reader at `/decisions` and `/decisions/constitution/<slug>`.

- [x] **Step 1: Write the failing tests**: at `/decisions` the list pane is the active pane and the
      reader shows the constitution's six principles; `/decisions/constitution/iii` shows the same
      reader with principle III in view and marked in the list; clicking "UI behaviour" (the
      fixture's) puts it in the reader at `/decisions/ui-behaviour`; with a feature's branch
      changing a decision, its reader shows the change as a diff before its rules; at 402 px the
      reader replaces the list, with "Constitution and decisions" leading back. The browser test's
      Escape now returns to `/decisions` and the constitution: write the ruling. Break: the reader
      showing one principle.
- [x] **Step 2: Run them to check they fail**. Expected: FAIL, no reader at `/decisions`.
- [x] **Step 3: Implement**: the list at 30% of the window on wide screens; the rows keep today's
      sort and its menu, with icon and summary; the check controls in the list pane's head.
- [x] **Step 4: Run the task's validation**: `nix develop -c vp run fast` and the decisions files.
      Expected: PASS.
- [x] **Step 5: Commit**: `git commit -m "feat(layout-look): decisions in three columns"`.

## Task 13: The palette

**Files:**

- Create: `packages/web/src/decisions/JumpPalette.tsx`, `src/__tests__/palette.test.tsx`
- Modify: `packages/web/src/decisions/DecisionsPage.tsx` ("Jump to…", the `/` key),
  `__browser__/decisions.test.tsx`

**Interfaces:**

- Consumes: Task 1's ruling on the palette's highlight; `useStatusHints` (Task 9).

- [ ] **Step 1: Write the failing tests**: `/` opens the palette, "noti" lists "Notifications", and
      its preview shows the decision's summary and first rules; Enter opens it in the reader; "zzz"
      reads "Nothing matches."; `/` typed in the sort menu or a text field opens nothing; ↓ in the
      open palette does not move the list behind it. Break: a palette that steals `/` from text
      fields.
- [ ] **Step 2: Run them to check they fail**. Expected: FAIL, no palette.
- [ ] **Step 3: Implement** it on `CommandPalette` with the preview beside it, or on Task 1's
      fallback.
- [ ] **Step 4: Run the task's validation**: `nix develop -c vp run fast` and the palette and
      decisions files. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat(layout-look): a palette to jump to any decision"`.

## Task 14: The stories, the screenshots, and the prototypes' removal

**Files:**

- Modify: `packages/web/src/Home.stories.tsx`, `decisions/DecisionsPage.stories.tsx`,
  `settings/SettingsView.stories.tsx`, `sidebar/Sidebar.stories.tsx` (now `shell/Shell.stories.tsx`)
- Create: the screenshots `scripts/screenshots.ts` writes for the changed views, phone and desktop,
  Latte and Mocha, in `specs/2026-10-20-layout-look/screenshots/`
- Delete: `specs/2026-10-20-layout-look/mockups/` except `README.md`, rewritten to say where the
  stories live
- Modify: the links to the deleted files, in `specs/2026-10-20-layout-look/`'s `plan.md`, `spec.md`,
  `rulings.md`, `clarifications-01.md`, `clarifications-02.md`, `discovery-01.md`, `discovery-02.md`

**Interfaces:**

- Consumes: every earlier task.

- [ ] **Step 1: Write the stories**: one export per state the spec names: the shell wide, semi-wide
      with the rail open, and narrow; the home with and without problems; decisions with the
      constitution, a changed decision, and the palette; settings and a search.
- [ ] **Step 2: Build them**: `nix develop -c vp run storybook:build`. Expected: PASS.
- [ ] **Step 3: Take and review the screenshots** of the shell, home, decisions, and settings at
      both sizes and in both schemes against the UI look and layout decisions, and commit them.
- [ ] **Step 4: Delete the prototypes**, now that the stories replace them, and rewrite every link
      to them (R8), or `ura check` fails: they sit in `plan.md`, `spec.md`, `rulings.md`,
      `clarifications-01.md`, `clarifications-02.md`, `discovery-01.md`, and `discovery-02.md`. The
      spec's mockup links become links to the stories that replace them, as the spec says. Every
      other link, image embeds and links with a query or a fragment included, becomes its text and
      the file's path in code, as the skill's approval step describes.
- [ ] **Step 5: Run the whole validation**: `nix develop -c vp run ready`. Expected: PASS.
- [ ] **Step 6: Commit**:
      `git commit -m "docs(layout-look): the stories and screenshots replace the prototypes"`.
