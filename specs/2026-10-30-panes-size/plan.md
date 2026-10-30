---
status: auto-approved
spec-revision: 1
---

# Plan: Panes size

**Goal:** Every page and pane of the web UI takes its width from one short scale of named widths,
set once in the theme, and the side column folds to a rail on a half screen.

**Architecture:** The scale is a set of theme tokens, declared by one function of the theme
(`theme/scale.ts`) from the reading measure, so the app's root redeclares them whenever the human
picks another reading font or size ([spec, Architecture](spec.md#architecture)). `Page` takes a
required `kind` instead of its flags, and owns each kind's column and where its title and crumbs
start. `Pane` keeps taking `--pane-max` from its page. The question card and the decision card take
their widths from the scale's tokens. The side column's width stays owned by
`documentColumnWidth.ts`, now 400 px until dragged; whether it is a rail beside a page too narrow
for a reading pane is owned by `SideColumn.tsx`, which reuses the shell's rail behaviour
(`shell/Rail.tsx`'s `useRail`) for hover, tap, keyboard focus, a click outside, and Escape. The
guides in `specs/ui/` state the scale once, in `reading.md`.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A reading font or size the human picks**: every width of the scale follows it, the big-text,
   split-card, and two-panes widths included, not only the reading pane. A token derived from
   `--size-reading-pane` and declared only in the theme resolves there, at the theme's default font,
   as `theme/fonts.ts` explains for `--pane-prose`. Task 1, checked in the sandbox with a larger
   reading size.
2. **The window crossing from semi-wide to wide while the rail is open over the page**: the column
   goes back beside the page, at its width, not over it; crossing back to semi-wide draws the rail
   closed. Task 4, checked in the sandbox.
3. **Asking the agent from a railed spec or plan** (`showDocumentColumn`, which opens Session): the
   column opens over the page, as a tap does, rather than doing nothing. Task 4.
4. **Escape while the rail is open over the page and a page's own Escape binding exists**: the
   page's binding runs first, as for the sidebar's rail (`useRail`'s fallback binding). Task 4.
5. **A session's page** keeps its column beside it at semi-wide, at its own width: the spec leaves a
   session's page unchanged. Task 4.
6. **The phone**: no rail, no width change; every pane stays the screen's width. Tasks 1 and 4,
   checked in the sandbox at 402 px.

## Global constraints

- From the [UI layout](/specs/decisions/ui-layout.md) decision, word for word: "The UI MUST adapt to
  three width classes, narrow, semi-wide, and wide, and size every page and pane from one short
  scale of named widths, picked by what it holds, both set once in the theme, never by a view."
- From the [UI components](/specs/decisions/ui-components.md) decision: every width is a theme
  token, never a number in a view; prose stays sized by the shared component. The token lint
  (`stylex/valid-styles` and `stylex/custom-property-tokens` in the root `vite.config.ts`) holds
  every width property of a view to `var(--…)`, percentages, and keywords.
- `size-reading-measure` and `text-reading-*` appear only in `Prose.tsx`, the theme, and the legacy
  files the lint test lists (`__tests__/lint.test.ts`, "reading text is set in Prose.tsx"): views
  use the scale's tokens.
- The scale, at the default fonts ([spec](spec.md)): reading pane 692 px; big text 865 px; split
  card about 1,080 px; two panes 1,424 px, two reading panes and their gap; whole window; code 108
  characters, unchanged; session 95 characters, unchanged; side column 400 px, dragged to 720 px.
- "A page's text column is a reading pane. A pane may grow past it only by what sits beside its
  text: a control, a tab, an inset, a row's marker. A page's title and crumbs start at its panes'
  left edge." ([spec](spec.md))
- No page changes width at 1,024 px: pages change width only at the three width classes.
- A side column width kept in the browser under `uraeda.documentColumn` before this feature is read
  as before, within 400 to 720 px (`layout/followedWidth.ts`'s `readStored`, clamped as drawn).
- On a half screen: "Hovering the rail, tapping it, or `]` opens the column over the page, without
  moving the page. It folds back when the pointer leaves, or on `]` or Escape." Opened by `]`, it
  "stays open until `]`, Escape, or a click outside it". Under reduced motion, it opens at once.
- The rail is for semi-wide windows only: wide windows keep the column beside the page, folded only
  by `]`.
- Dialogs, pickers, the detail overlay, and the sign-in form keep their widths.
- From the [Testing](/specs/decisions/testing.md) decision: at the `early` stage, a test of the web
  UI guards behaviour costly to lose that using the UI would not show; the agent reviews each
  changed view in the running app, in both themes, at a phone's and a desktop's width.

## Code read

- [`layout/Page.tsx`](/packages/web/src/layout/Page.tsx): a page's column, `--size-page-max` wide
  without a flag; `isReading` sets `--pane-max` to `--pane-prose` and centres panes; `isPaired`
  widens the page to two panes; `isWriting`, `isSession`, `isFull`, `isTight`, `isSnug`. Centred on
  the screen by `useScreenCentre`. 27 callers, listed by `rg '<Page\b' packages/web/src`.
- [`theme/theme.ts`](/packages/web/src/theme/theme.ts): `--size-reading-measure`,
  `--size-reading-pane`, `--size-page-max` (720 px, and 1,200 px from Astryx's `lg` in
  `adaptations.rules`), `--size-session-max` (95ch), `--size-round-split` (840 px),
  `--size-pane-min`. The built theme is `theme/built/uraeda.{css,js}`, rebuilt by
  `vp run --filter uraeda-web theme`.
- [`theme/fonts.ts`](/packages/web/src/theme/fonts.ts): the app root's font style redeclares
  `--size-reading-measure`, `--size-reading-pane`, and `--pane-prose` for the picked font, because a
  custom property's `var()` resolves where it is declared.
- [`layout/pane.stylex.ts`](/packages/web/src/layout/pane.stylex.ts): `--pane-prose`, `--pane-code`
  (108ch). Read by `Page.tsx`, `QuestionCard.tsx`, `spec/DecisionCard.tsx`, `EditorPage.tsx`.
- [`layout/Pane.tsx`](/packages/web/src/layout/Pane.tsx): a pane's
  `maxWidth: var(--pane-max, none)`, `marginInline: var(--pane-centre, 0)`,
  `width: var(--pane-width, auto)`.
- [`layout/PageTitle.tsx`](/packages/web/src/layout/PageTitle.tsx) and
  [`Crumbs.tsx`](/packages/web/src/Crumbs.tsx): the title and crumbs, at the page column's edge.
- [`Shell.tsx`](/packages/web/src/Shell.tsx): the refused Undos' banner, `--size-page-max` wide.
- [`QuestionCard.tsx`](/packages/web/src/QuestionCard.tsx),
  [`QuestionCards.tsx`](/packages/web/src/QuestionCards.tsx): a card splits 5 to 6 once its group is
  `--size-round-split` wide (`useAtLeast`); split, it takes the page's column; `windowed`, the
  page's column with its text at `--pane-prose` less the card's padding.
- [`spec/DecisionCard.tsx`](/packages/web/src/spec/DecisionCard.tsx):
  `--pane-max: calc(1.25 * --pane-prose)`.
- [`settings/SettingRow.tsx`](/packages/web/src/settings/SettingRow.tsx): the text grows, the
  control at the row's end, under the text on the phone.
- [`lists/list.stylex.ts`](/packages/web/src/lists/list.stylex.ts): `--list-line-max`,
  `calc(80ch + 4rem)`, the priorities' single list (`lists/WorkList.tsx`).
- [`home/parts.tsx`](/packages/web/src/home/parts.tsx) `Columns`, and
  [`KindCards.tsx`](/packages/web/src/KindCards.tsx): the home's two columns and New's three cards,
  grids that fill the page.
- [`layout/documentColumnWidth.ts`](/packages/web/src/layout/documentColumnWidth.ts) and
  [`layout/followedWidth.ts`](/packages/web/src/layout/followedWidth.ts): the column is a third of
  the window, 400 to 600 px, until dragged, then 400 to 720 px; a session's 300 to 360 px at
  semi-wide. `showDocumentColumn` unfolds every drawn column.
- [`layout/SideColumn.tsx`](/packages/web/src/layout/SideColumn.tsx): the column beside the page on
  semi-wide and wide screens, folded by `]` to a 48 px rail of icons. Callers:
  `layout/DocumentColumn.tsx` (spec, plan, round, session) and `feature/FeatureColumn.tsx`.
- [`shell/Rail.tsx`](/packages/web/src/shell/Rail.tsx) `useRail`: the sidebar's rail opens over the
  page after the mouse rests 250 ms, on keyboard focus, or on a tap of its button; Escape, a click
  outside, the mouse or focus leaving, or a route change close it.
- [`layout/useWidthOf.ts`](/packages/web/src/layout/useWidthOf.ts): an element's width, and
  `useAtLeast`, an element at least as wide as a theme token.
- Tests: Vitest in jsdom, `packages/web/src/__tests__/`; the side column's
  [`document-column.test.ts`](/packages/web/src/__tests__/document-column.test.ts) and the token
  lint's [`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts). No test checks a page's or a
  pane's width.
- Validation: the fast check is `vp check` and `vp test <files>` in `packages/web`; `vp run ready`
  before the push. Views are reviewed in `vp run sandbox`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

| What                            | Why                                                                                                                         | Simpler alternative rejected                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `theme/scale.ts`, `scaleTokens` | the theme and the font root both declare the measure-derived widths; one function keeps them from drifting (Review focus 1) | copying each token into `fonts.ts`: two homes for one rule, as `--size-reading-pane` is today |
| `Page`'s `kind`                 | the spec's architecture: a view names what it holds, never a number                                                         | keeping the flags: `isPaired` and `isReading` together mean nothing the scale names           |
| `SideColumn` reuses `useRail`   | the spec asks the column's rail to behave as the sidebar's; one owner for hover, tap, focus, Escape                         | a second rail hook in `layout/`: two copies of the same timing and closing rules              |

## Test map

The one new test renders the column's width hook in jsdom with `@testing-library/react`'s
`renderHook`, on the browser's `localStorage`; every other row is checked in the sandbox
(`vp run sandbox`, Chromium), as the Testing decision asks of the UI.

| Spec                                                                                                | Task | Check                                                                                   |
| --------------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------- |
| US1 key 1: feature at 1920 px, panes 692 px, column 400 px                                          | 1, 4 | sandbox; the column's 400 px: `document-column.test.ts`, "the column starts at 400 px…" |
| US1 key 2: settings' text at 692 px, control beside it                                              | 3    | sandbox                                                                                 |
| US1 key 3: priorities' list text column 692 px                                                      | 3    | sandbox                                                                                 |
| US1 more 1: inbox at 1100 px, 692 px                                                                | 1    | sandbox                                                                                 |
| US1 more 2: a dragged 560 px column stays                                                           | 4    | `document-column.test.ts`, "the column starts at 400 px…"                               |
| US1 more 3: no width change at 1024 px                                                              | 1    | sandbox at 1000 and 1050 px (SC-003)                                                    |
| US2 key 1: split card about 1,080 px under 692 px context                                           | 2    | sandbox                                                                                 |
| US2 key 2: every split card the same width                                                          | 2    | sandbox                                                                                 |
| US2 more 1: a card with a mockup keeps the whole column                                             | 2    | sandbox                                                                                 |
| US2 more 2: one column with less room than the split width                                          | 2    | sandbox at 1100 px                                                                      |
| US3 key 1–3: rail at 1000 px, hover opens and closes, `]` holds it                                  | 4    | sandbox                                                                                 |
| US3 more 1: at 1260 px with room, the column stays beside                                           | 4    | sandbox                                                                                 |
| US3 more 2: Session in the address shows picked in the rail                                         | 4    | sandbox                                                                                 |
| US4 key 1–2: home and New at two reading panes                                                      | 1    | sandbox                                                                                 |
| US5 key 1: decision card 865 px, other panes 692 px                                                 | 2    | sandbox                                                                                 |
| Edge, high: a kept column width read within 400 to 720 px                                           | 4    | `document-column.test.ts`, "the column starts at 400 px…", with `readStored`'s clamp    |
| Edge: a larger reading font or size                                                                 | 1    | sandbox, Settings' reading size (Review focus 1)                                        |
| Edge: 1,280 px with the sidebar open: no rail                                                       | 4    | sandbox                                                                                 |
| Edge: sidebar folded on a wide window, page centred                                                 | 1    | sandbox; `useScreenCentre` unchanged                                                    |
| Edge: a table wider than the text column scrolls in its pane                                        | 1    | none: `Pane`'s `--table-reach` is unchanged                                             |
| Edge: semi-wide window wide enough for both                                                         | 4    | sandbox                                                                                 |
| Edge: reduced motion                                                                                | 4    | none: the easing's reduced-motion rule is unchanged, and reused                         |
| SC-001 one text column at 1920 and 1100 px                                                          | 5    | sandbox measurement, recorded in the pull request                                       |
| SC-002 80 characters at 1000 px                                                                     | 5    | sandbox measurement                                                                     |
| SC-003 no jump between 1,000 and 1,050 px                                                           | 5    | sandbox measurement                                                                     |
| SC-004 tokens only                                                                                  | 1–3  | the token lint, `vp check`                                                              |
| Review focus: fonts (1), semi to wide (2), asking the agent (3), Escape (4), session (5), phone (6) | 1, 4 | sandbox                                                                                 |

## Waves

- Wave 1: task 1, alone: every later task reads its tokens and `Page`'s `kind`.
- Wave 2: tasks 2, 3, and 4. Their files differ: the cards (2), settings and the priorities' list
  (3), the side column (4).
- Wave 3: task 5, the guides and the measurements, once the widths are built.

---

## Task 1: The scale, and the page's kinds

**Files:**

- Create: `packages/web/src/theme/scale.ts`
- Modify: `packages/web/src/theme/theme.ts` (the widths in `localTokens`, the `lg` rule of
  `adaptations.rules`), `packages/web/src/theme/fonts.ts` (the root's measure tokens),
  `packages/web/src/theme/built/uraeda.css`, `packages/web/src/theme/built/uraeda.js` (rebuilt)
- Modify: `packages/web/src/layout/Page.tsx`, `packages/web/src/layout/pane.stylex.ts`,
  `packages/web/src/layout/Pane.tsx` (its width comment), `packages/web/src/layout/PageTitle.tsx`,
  `packages/web/src/Crumbs.tsx`, `packages/web/src/Shell.tsx` (`errors`), and what a reading page
  draws outside its panes: `packages/web/src/RoundOpening.tsx` (the round's title),
  `packages/web/src/review/useReview.tsx` (`ReviewIntro`), `packages/web/src/PlanPage.tsx` (the
  plan's opening blocks)
- Modify: every caller of `Page`, by `rg '<Page\b' packages/web/src`

**Interfaces:**

- Produces: the theme tokens `--size-reading-pane` (unchanged name), `--size-big-text`,
  `--size-split-card`, `--size-two-panes`, `--size-code`, `--size-session-max` (unchanged), and
  `--size-setting-control`; `--size-page-max` and `--size-round-split` are gone.
- Produces: `Page({ kind, beside?, isSnug?, isTight?, children })`, with
  `kind: "reading" | "rows" | "panes" | "window" | "code" | "session"`, required, and
  `beside?: \`--size-${string}\``, the theme's width of what sits beside a page of rows' text
  column.
- Produces: `PageTitle` and `Crumbs` start at the page's panes' left edge on a reading page.

- [x] **Step 1: Write the scale**

`theme/scale.ts` exports `scaleTokens(measure: string)`, the tokens derived from the reading
measure, for the theme's `localTokens` and for `fonts.ts`'s root style, which spreads it in place of
its own `--size-reading-measure` and `--size-reading-pane`:

- `--size-reading-measure`: the measure given, today `calc(37.85 * var(--text-reading-size))` in the
  theme and `calc(${measure} * var(--text-reading-size))` in `fonts.ts`.
- `--size-reading-pane`: unchanged, the measure, `2 * --spacing-3`, and `2 * --border-width`.
- `--size-big-text`: `1.25` reading panes, 865 px.
- `--size-split-card`: `1.5` measures, the card's column gap (`--spacing-8`), its padding
  (`2 * --spacing-6`), and its border: about 1,080 px, the question at about 50 characters, its
  options at about 60, as the card's 5 to 6 columns split it.
- `--size-two-panes`: two reading panes and `--spacing-4`, the gap of the home's `Columns` grid.

The `ch` widths stay in the theme's `localTokens` only, at their values: `--size-code` (`108ch`, in
place of `pane.stylex.ts`'s `--pane-code`) and `--size-session-max` (`95ch`). Add
`--size-setting-control`, the room a setting's control takes beside its text: the widest control's
width (`OtherSettings.tsx`'s `32ch` field) and the row's gap. Drop `--size-page-max`, its `lg` rule,
and `--size-round-split`. `pane.stylex.ts`'s `--pane-prose` and `--pane-code` go, their readers
using the theme's tokens; `fonts.ts` stops setting `--pane-prose`.

- [x] **Step 2: Give `Page` its kinds**

Each kind's column on semi-wide and wide screens, the page's `--page-inset` at each side; on the
phone, every kind fills the screen as today, with no width of its own:

- `reading` (spec, plan, document, data model, round): the two-panes width; `--pane-max` the reading
  pane, panes centred (`--pane-centre: auto`, `--pane-width: 100%`), as `isReading` did. A live
  window, a split card, or a decision card grows past it within this column.
- `rows` (feature, inbox, settings, sessions, commit, triage, decisions check, a branch's decision,
  a missing file, the repository pages, the first run, the decisions page's list alone, the editor's
  missing file): the reading pane, plus `beside` when given.
- `panes` (home, New, a story's page): the two-panes width.
- `window` (priorities): the window's width, as `isFull`.
- `code` (the proposal editor): as `isWriting`, its panes at `--size-code`, with Start beside them.
- `session` (a session's page): `--size-session-max`, as `isSession`.

`isTight` and `isSnug` stay, phone insets. `useScreenCentre` still centres every kind but `window`.
`PageTitle` and `Crumbs` take `maxWidth: var(--pane-max, none)` and
`marginInline: var(--pane-centre, 0)`, as `Pane` does, so on a reading page they start at the panes'
left edge. `Shell.tsx`'s refused Undos' banner takes the reading pane's width.

- [x] **Step 3: Give every caller its kind**

`kind` is required: `vp check` lists every caller left. The kind of each is in step 2; a page not
named there is `rows`.

- [x] **Step 4: Rebuild the theme, and run the task's validation**

- Run: `vp run --filter uraeda-web theme`, then `vp check` and `vp test` in `packages/web`
- Expected: PASS;
  `rg 'size-page-max|size-round-split|pane-prose|pane-code|isPaired|isReading' packages/web/src`
  finds nothing outside `theme/built/` comments
- Deferred to `vp run ready`: the Rust and server suites, untouched.

- [x] **Step 5: Review the pages in the sandbox**

In `vp run sandbox`, at 1920, 1100, 1000, and 402 px, light and dark: the feature page, the inbox,
settings, sessions, the home, New, a spec, a plan, a round, and the editor. Rows pages' panes are
692 px and their titles at the panes' left edge; the home's columns 692 px each; a spec's title at
its panes' edge; nothing changes width between 1,000 and 1,050 px; the phone unchanged. Then pick a
larger reading size in Settings: a reading pane and the two-panes width grow with it (Review focus
1).

- [x] **Step 6: Commit**

```bash
git add packages/web/src specs/2026-10-30-panes-size/plan.md
git commit -m "feat(panes-size): one scale of widths for every page"
```

## Task 2: The cards at the scale's widths

**Files:**

- Modify: `packages/web/src/QuestionCard.tsx`, `packages/web/src/QuestionCards.tsx`,
  `packages/web/src/spec/DecisionCard.tsx`, `packages/web/src/layout/useWidthOf.ts` (`useAtLeast`
  reads a token made of others)

**Interfaces:**

- Consumes: `--size-reading-pane`, `--size-split-card`, `--size-big-text` (task 1), and the reading
  page's `--pane-max` and `--pane-centre`.

- [x] **Step 1: Size the question card**

A split card is `--size-split-card` wide at most, centred in the page; a card of one column a
reading pane, as today; a card holding a live window keeps the page's whole column, its text a
reading pane less the card's padding, as today. A card splits once its group is at least
`--size-split-card` wide (`useAtLeast(group, "--size-split-card")`), so a card with less room than
its split width keeps one column. Every split card of a round is the same width, whatever it holds.

- [x] **Step 2: Size the decision card**

A spec's decision card's `--pane-max` is `var(--size-big-text)`, centred, its text still at the
reading measure.

- [x] **Step 3: Run the task's validation**

- Run: `vp check` and `vp test` in `packages/web`
- Expected: PASS

- [x] **Step 4: Review in the sandbox**

A round at 1920 px: context 692 px, split cards about 1,080 px, all the same width, centred; a card
with a mockup takes the whole column, its text 692 px. At 1100 px, one column. A spec at 1920 px:
decision cards 865 px. Light and dark, and the phone.

- [x] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-30-panes-size/plan.md
git commit -m "feat(panes-size): question and decision cards at the scale's widths"
```

## Task 3: Rows that keep their text column

**Files:**

- Modify: `packages/web/src/settings/SettingsView.tsx` (its `Page`'s `beside`),
  `packages/web/src/settings/SettingRow.tsx`, `packages/web/src/lists/list.stylex.ts`,
  `packages/web/src/lists/WorkList.tsx` (the list's width, a reading pane)

**Interfaces:**

- Consumes: `Page`'s `kind="rows"` and `beside`, `--size-setting-control`, `--size-reading-pane`
  (task 1).

- [x] **Step 1: Settings' controls beside their text**

Settings is a page of rows with `beside="--size-setting-control"`. On semi-wide and wide screens, a
row's text keeps to the text column, a reading pane less the pane's room, and its control sits at
the row's end beside it; on the phone, the control under the text, as today.

- [x] **Step 2: The priorities' single list at the text column**

The single list is a reading pane wide, its rows' markers and selection inside its panes, in place
of `--list-line-max`: the list's text column is 692 px at the default fonts.

- [x] **Step 3: Run the task's validation**

- Run: `vp check` and `vp test` in `packages/web`
- Expected: PASS

- [x] **Step 4: Review in the sandbox**

At 1920 px: settings' text wraps at 692 px, each control beside it, the title at the pane's edge;
the priorities in one list (`v`), its text column 692 px. The phone unchanged.

- [x] **Step 5: Commit**

```bash
git add packages/web/src specs/2026-10-30-panes-size/plan.md
git commit -m "feat(panes-size): settings and the priorities' list keep a reading pane of text"
```

## Task 4: The side column, 400 px, and its rail on a half screen

**Files:**

- Modify: `packages/web/src/layout/documentColumnWidth.ts`,
  `packages/web/src/layout/SideColumn.tsx`, `packages/web/src/layout/DocumentColumn.tsx` (the rail's
  picked tab), `packages/web/src/session/SessionColumn.tsx` (the column kept beside),
  `packages/web/src/layout/useWidthOf.ts` (`useLengthIn`, the page's least room in px), and
  `packages/web/src/shell/Rail.tsx`'s `useRail`, reused unchanged
- Test: `packages/web/src/__tests__/document-column.test.ts`

**Interfaces:**

- Consumes: `--size-reading-pane` (task 1), `useRail(isRail, ref, button)` from `shell/Rail.tsx`.
- Produces: `useDocumentColumnWidth()` starts at 400 px at every window width; `SideColumn` takes
  `isBeside?: boolean`, which keeps the column beside the page at semi-wide (a session's);
  `showDocumentColumn()` also opens a railed column over the page, through `useOpenOnShow(open)` of
  `documentColumnWidth.ts`.

- [x] **Step 1: Write the failing test**

```ts
// packages/web/src/__tests__/document-column.test.ts
test.each([
  [800, undefined, 400],
  [1920, undefined, 400],
  [1920, 560, 560],
  [1920, 900, 720],
])("at %i px, kept %s, the column starts at 400 px or the width dragged", (window, kept, width) => {
  if (kept !== undefined) {
    localStorage.setItem(COLUMN_KEY, JSON.stringify({ width: kept }));
  }
  setWindowWidth(window);
  expect(renderHook(() => useDocumentColumnWidth()).result.current.resizable.size).toBe(width);
});
```

`setWindowWidth` sets `window.innerWidth` and dispatches `resize`, in the test file. The break each
row catches: 1920 without a drag, a column that still takes a third of the window; 560, a kept width
the new start overrides; 900, a kept width no longer clamped.

- [x] **Step 2: Run it to check it fails**

- Run: `vp test src/__tests__/document-column.test.ts` in `packages/web`
- Expected: FAIL at 1920 px without a drag, `expected 600 to be 400`

- [x] **Step 3: Start the column at 400 px**

The documents' column starts at 400 px, the least of its drag, at every window width, then the width
dragged, within 400 to 720 px. A session's column keeps its own start at semi-wide. Drop what only
served the third of the window.

- [x] **Step 4: Fold the column to a rail on a half screen**

On a semi-wide window, unless `isBeside`, the column is a rail when the page beside it would keep
less than a reading pane: the room of `SideColumn`'s own box, less the column's width, under
`--size-reading-pane` and the page's insets, read from the theme as `useAtLeast` does. The rail is
`--size-rail` wide, the sidebar's rail, folded or railed, in place of today's 48 px. Railed:

- the rail shows each tab's icon, the open tab's picked (`DocumentColumn`'s `rail`, with
  `layout/picked.ts`'s look);
- `useRail` opens it over the page, at the column's width, without moving the page: the mouse
  resting on it, keyboard focus in it, a tap on its empty space, its button, or `]`;
- it closes as `useRail` closes the sidebar's: the mouse leaving, Escape, a click outside, `]`, or
  the button; under reduced motion, at once;
- the open column has no resize bar;
- `showDocumentColumn()` opens it, as a tap does (Review focus 3);
- crossing to wide puts the column back beside the page at its width (Review focus 2).

A wide window, and a semi-wide one with room for both, keep today's column, folded by `]` only.

- [x] **Step 5: Keep a session's column beside its page**

`SessionColumn` passes `isBeside` (Review focus 5).

- [x] **Step 6: Run the task's validation**

- Run: `vp check` and `vp test` in `packages/web`
- Expected: PASS

- [x] **Step 7: Review in the sandbox**

At 1000 px: a spec, a plan, a round, and the feature page draw a 52 px rail and 692 px panes;
hovering opens the column over the page at 400 px, the page still; `]` holds it until `]`, Escape,
or a click outside; `?tab=session` shows Session's icon picked. At 1260 px with the sidebar folded,
and at 1280 px with it open, the column beside the page. A session's page at 1000 px, its column
beside it. Widen the window while the rail is open. Light and dark, and the phone.

- [x] **Step 8: Commit**

```bash
git add packages/web/src specs/2026-10-30-panes-size/plan.md
git commit -m "feat(panes-size): a 400 px side column, a rail on a half screen"
```

## Task 5: The guides, and the measurements

**Files:**

- Modify: `specs/ui/reading.md` (Line length: the scale, once), `specs/ui/wide.md`,
  `specs/ui/semi-wide.md`, `specs/ui/space-and-motion.md` (only where it states a width), and any
  other guide of `specs/ui/` that states a width the feature changed

**Interfaces:**

- Consumes: what tasks 1 to 4 built.

- [ ] **Step 1: State the scale in the guides**

`reading.md`'s Line length holds the scale's table, by name, with what each width holds and its
theme token; the rule that a page's text column is a reading pane, and what may grow past it; the
title and crumbs at the panes' edge. `wide.md` and `semi-wide.md` link to it rather than restate
numbers: the side column at 400 px, a rail on a half screen when the page would keep less than a
reading pane; a split card at its own width; no 1,200 px column. Quote nothing the human did not
say.

- [ ] **Step 2: Measure the success criteria in the sandbox**

In Chromium, the sidebar open: every page of rows' text column at 1920 and 1100 px (SC-001); a
spec's prose characters a line at 1000 px (SC-002); every page's pane widths at 1,000 and 1,050 px
(SC-003). Keep the table for the pull request's body.

- [ ] **Step 3: Run the task's validation**

- Run: `vp check` at the root, and `ura check`
- Expected: PASS, and no new warning

- [ ] **Step 4: Commit**

```bash
git add specs/ui specs/2026-10-30-panes-size/plan.md
git commit -m "docs(panes-size): the scale of widths in the UI guides"
```
