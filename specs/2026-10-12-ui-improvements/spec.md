---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: UI improvements

> [!IMPORTANT]
>
> Spec to review, with its mockups and four new decisions, about 50 minutes.
>
> - Four new decisions set how this app's UI is built, from your answers to the first four
>   questions:
>   - [UI components](../decisions/ui-components.md): Astryx first, StyleX with tokens only, no
>     global stylesheet, and `@dnd-kit/react` for dragging.
>   - [UI layout](../decisions/ui-layout.md): two width classes, side panes on wide screens, text
>     sizes, and left-aligned text.
>   - [UI behaviour](../decisions/ui-behaviour.md): overlays, feedback, editing in place, and state.
>   - [UI checks](../decisions/ui-checks.md): which tests, and screenshots for review.
> - Two of your answers pulled against each other: Q2 opens forms in dialogs on wide screens, and Q3
>   keeps modals for confirmations. Read as: a short form, like ＋ or a line's edit, may be a modal
>   dialog or sheet; everything else happens in place. The review's comment field opens under its
>   block on desktop, like GitHub, with no overlay at all.
> - Your note on tests is a rule of the checks decision: every UI test guards a behaviour of a spec
>   or a rule of a decision, through what a user sees and does. No test of markup, class names, or
>   pixels.
> - Your answer to the round's navigation puts it in the phone's top bar: "Uraeda", the count, which
>   opens the index, Next, and the menu. ＋ leaves every page but home and the priorities page, as
>   your note asks.
> - A correction: the theme switch is not hidden on the phone, I was wrong in discovery; it is at
>   the end of the menu drawer, and stays there. Only the Astryx upgrade and the missing file's loop
>   remain of that question.
> - New drafts keep the line as their title and also under What (Q10 B). `ura start` still refuses a
>   draft whose Why is empty. `ura draft` and the skill change with the UI.
> - The largest cost: every page's styles move from `styles.css` to StyleX, which needs StyleX's
>   Vite plugin, and the theme becomes the app's own build of Astryx's neutral theme.
> - Risk tier `medium`: no stored data changes besides new drafts' text, but every page changes. The
>   plan does not wait for your review.

The web UI is how the human works on Uraeda from the phone and, more and more, from the desktop.
This feature makes it read and behave well on both:

- larger text on desktop;
- the reading position kept in a round, with navigation through its questions;
- a task view for every priority line;
- a priorities page edited in place, with animated dragging;
- drafts without placeholders;
- the reviewed block in view while commenting;
- a top bar that links home.

It also sets four decisions, so the next view is built the same way. See the
[proposal](proposal.md), [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

## User stories

### US1: Keep my place in a round (P1)

On the phone, the round's navigation lives in the top bar, where ＋ and empty space used to be:
"Uraeda", "7/12", which opens the index, a Next button that goes to the next unanswered question,
and the menu. The index lists every question and follow-up with its state, and opens in a sheet. On
a wide screen, the same index sits in a sticky column beside the questions, with the progress and
Next at its top, and `n` and `p` move between unanswered questions. Back returns to where the human
was. Opening the round again from home or the menu returns to where they left it on this browser,
and otherwise to the first unanswered question.

Why this priority: the round is the page used most, and losing the place in it was the proposal's
main complaint ([Q11](clarifications-01.md#q11-how-do-you-move-through-a-round-of-questions),
[Q12](clarifications-01.md#q12-where-does-a-round-open-when-you-come-back-to-it)).

Acceptance scenarios:

1. **Given** a round of 12 applicable questions with Q1 to Q6 answered, on a 402 px wide screen,
   **When** the page opens, **Then** the top bar shows "Uraeda", "6/12", "Next", and the menu, and
   no ＋.
2. **Given** the same round scrolled to Q2, **When** the human taps Next, **Then** Q7 is at the top
   of the screen below the bar, and its title has the focus.
3. **Given** Q7 answered while Q8 to Q12 are blank, **When** the human taps Next with Q7 at the top,
   **Then** Q8 comes to the top.
4. **Given** every applicable question answered, **When** the human looks at the bar, **Then** it
   reads "12/12", and Next is replaced by "Submit", which scrolls to the end of the page.
5. **Given** the round, **When** the human taps "6/12", **Then** a sheet lists Q1 to Q12 in order,
   with Q2.B under Q2 once it applies, each marked answered or not, and the question at the top of
   the screen marked current; **When** they tap Q9, **Then** the sheet closes and Q9 is at the top.
6. **Given** a 1440 px wide screen, **When** the round opens, **Then** the index is a column beside
   the questions, stays in view while scrolling, and shows "6/12" and Next above the list.
7. **Given** a 1440 px wide screen with Q3 at the top, **When** the human presses `n`, **Then** Q7
   comes to the top; **When** they press `p`, **Then** Q3 comes back. Neither key acts while a text
   field has the focus.
8. **Given** the round scrolled to Q9, **When** the human follows the link to `discovery-01.md` and
   comes back with Back, **Then** Q9 is at the top of the screen again, without "Loading…" shown in
   between.
9. **Given** the round left at Q9 on this browser, **When** the human opens it again from home,
   **Then** Q9 is at the top.
10. **Given** a browser that never opened the round, with Q1 to Q6 answered, **When** the human
    opens it, **Then** Q7 is at the top.

### US2: Comment with the block in view (P1)

Tapping a block of a spec, plan, or assessment selects it, as today, and the block stays clearly
tinted, in a colour of its own, while the comment is written. On the phone, the comment sheet opens
with the block scrolled into the space above it, and quotes the lines it comments on. On a wide
screen, the comment field opens right under the selected block, with no overlay, as GitHub does.

Why this priority: commenting without seeing what is commented on is the review's main flaw, and the
review is the human's main gate.

Acceptance scenarios:

1. **Given** a spec waiting for review on a 402 × 874 screen, scrolled so scenario 1 of US2 (lines
   92–93) sits at the bottom of the screen, **When** the human taps it, **Then** the comment sheet
   opens, the scenario's block is fully visible above the sheet, tinted, and the sheet starts with
   "Lines 92–93, under "US2: ..."" and the scenario's first line.
2. **Given** that sheet open, **When** the human taps the next block (lines 94–95) above the sheet,
   **Then** both blocks are tinted, and the sheet reads "Lines 92–95".
3. **Given** a 1440 px wide screen, **When** the human taps the same scenario, **Then** a comment
   field opens directly under the block, inside the page, with Cancel and Add comment, and nothing
   covers the page.
4. **Given** the comment field open, **When** the human taps Cancel, **Then** the field closes and
   the block is no longer tinted.

### US3: A task view for every priority (P1)

Every priority line on home and on the priorities page opens a task view: the line, editable in
place; its section, which can be changed; its draft drawn as a document with Edit and Start the
feature, or a Draft button when it has none; Delete; and previous and next through its section. On
the phone, it is a page. On a wide screen, it opens in a pane beside the list it came from, which
stays usable.

Why this priority: the proposal's "task view with all the options", and the one place to act on a
priority ([Q7](clarifications-01.md#q7-what-does-tapping-a-task-on-home-open)).

Acceptance scenarios:

1. **Given** the Next line "Git listener process" with no draft, on the phone, **When** the human
   taps it on home, **Then** the page `/priorities/git-listener-process` shows the line, "Next",
   Move, Delete, and Draft.
2. **Given** the Later line "Nice TUI" linking `drafts/cli-tuis.md`, **When** the human opens its
   task view at `/priorities/cli-tuis`, **Then** the draft is drawn as a document, with Edit and
   Start the feature, and no text field.
3. **Given** the task view of "Git listener process", **When** the human taps the line's text,
   changes it to "Git listener and runner", and presses Enter, **Then** `PRIORITIES.md` has the new
   text, uncommitted, and the view's address becomes `/priorities/git-listener-and-runner`.
4. **Given** that task view, **When** the human picks Later as its section, **Then** the line ends
   the Later section, and the view shows "Later".
5. **Given** a 1440 px wide screen on home, **When** the human taps a priority line, **Then** the
   task view opens in a pane on the right, the address changes, and the home list stays visible and
   scrollable on the left; **When** they press Back, **Then** the pane closes.
6. **Given** the task view of the second line of Next, **When** the human taps Next ›, **Then** the
   view shows the third line of Next; on the last line, Next › is disabled.
7. **Given** a task view open at `/priorities/git-listener-process`, **When** the page reloads,
   **Then** the same line shows.

### US4: Groom the priorities in place (P1)

The priorities page shows each section as a heading with its count, Now first and set apart. A tap
on a line's text edits it in place. Each section ends with an "Add to <section>" row. A line drags
by its handle on desktop or by a press-and-hold on the phone, and the other lines move out of its
way as it goes. A ⋯ menu, a popover on desktop and a sheet on the phone, holds Move up, Move down,
Move to each section, Open, and Delete. Deleting shows "Deleted" with Undo for 5 seconds.

Why this priority: the proposal calls the page "a mess", and editing behind a modal was its sharpest
complaint ([Q8](clarifications-01.md#q8-how-are-lines-edited-and-added-on-the-priorities-page),
[Q9](clarifications-01.md#q9-how-should-dragging-a-line-work)).

Acceptance scenarios:

1. **Given** Now holding 4 lines and Next 7, **When** the page opens, **Then** it shows "Now · 4"
   and "Next · 7" as headings, and each section ends with its "Add to …" row.
2. **Given** the Next line "Nvim plugin", **When** the human taps its text, types " for answers",
   and presses Enter, **Then** the line reads "Nvim plugin for answers" in `PRIORITIES.md`, and the
   commit bar reads "1 change to commit".
3. **Given** a line being edited, **When** the human presses Escape, **Then** the line keeps its
   text and nothing is written.
4. **Given** the "Add to Later" row, **When** the human taps it, types "Ship a TUI", and presses
   Enter, **Then** "Ship a TUI" ends Later, and a new empty row is ready for the next line.
5. **Given** Next holding "Git listener process" then "Ping user when input is needed", **When** the
   human drags the second by its handle above the first, **Then** the first slides down while the
   drag passes over it, and on release the file lists them in that order.
6. **Given** a phone, **When** the human presses and holds a line for half a second and drags it,
   **Then** the line lifts and moves with the finger; a quicker swipe scrolls the page instead.
7. **Given** a line focused on desktop, **When** the human presses Space, then ↓ twice, then Space,
   **Then** the line moves down two places, and a screen reader hears its new position.
8. **Given** the ⋯ menu of "Nvim plugin" on a 1440 px screen, **When** it opens, **Then** it is a
   popover next to the button; on a 402 px screen, a sheet with a Close button.
9. **Given** "Nvim plugin" with a nested line under it, **When** the human deletes it, **Then** both
   lines leave the file, and a toast "Deleted "Nvim plugin"" with Undo shows; **When** they tap Undo
   within 5 seconds, **Then** both lines are back at the same place.

### US5: Drafts without placeholders (P2)

Drafting a priority line writes the line as the title and under What, the template's headings, and
no placeholder text, from the UI and from `ura draft` alike. The draft opens in the editor with each
empty section showing its guidance as a dimmed hint. A written draft or proposal opens drawn as a
document, with Edit.

Why this priority: deleting placeholders on a phone was the annoyance, and every feature starts from
a draft ([Q10](clarifications-01.md#q10-what-should-a-new-draft-hold)).

Acceptance scenarios:

1. **Given** the Next line "Git listener process", **When** the human taps Draft, **Then**
   `specs/drafts/git-listener-process.md` reads, after its frontmatter `discovery: high`:
   `# Git listener process`, `## What`, `Git listener process`, `## Why`, and `## Notes`, with no
   bracketed placeholder.
2. **Given** the same line, **When** `ura draft "git listener"` runs, **Then** it writes the same
   file, byte for byte.
3. **Given** that new draft open in the editor, **When** the human looks at Why, **Then** a dimmed
   "The problem it solves, and for whom." shows there, and the file holds no such text.
4. **Given** that draft with Why still empty, **When** the human taps Start the feature, **Then**
   `ura start`'s refusal shows: "specs/drafts/git-listener-process.md still holds the template's
   placeholders: write it first", and nothing changes.
5. **Given** a committed proposal with a written What and Why, **When** the human opens it, **Then**
   it is drawn as a document with Edit; **When** they tap Edit, **Then** the text editor opens.

### US6: A desktop that reads right (P1)

On a screen 1024 px wide or more, body text is 19 px, and controls and spacing grow in the same
proportion, so the desktop looks as it does today at 120% zoom. The reading column is capped near 70
characters. Text is left-aligned, never justified, and its lines are balanced. "Uraeda" in the top
bar or the side navigation goes home. ＋ shows on home and the priorities page only, and when the
line it adds is not in view, a toast says where it went.

Why this priority: the human zooms every desktop visit today
([Q5](clarifications-01.md#q5-how-large-should-text-be-on-desktop),
[Q6](clarifications-01.md#q6-should-paragraphs-be-justified), and the notes).

Acceptance scenarios:

1. **Given** a 1440 × 900 screen, **When** any page opens, **Then** paragraph text is 19 px, and a
   medium button is at least 38 px tall (32 px × 1.2).
2. **Given** a 402 × 874 touch screen, **When** any page opens, **Then** paragraph text is 17 px,
   and every control is at least 44 px tall.
3. **Given** a 1440 px wide document page, **When** it opens, **Then** no line of a paragraph holds
   more than about 75 characters.
4. **Given** any page, **When** the human taps "Uraeda" in the top bar or the side navigation,
   **Then** home opens.
5. **Given** home, **When** the human taps ＋, types "Show the agent's last commit", picks Later,
   and taps Add, **Then** the line ends Later, uncommitted, and a toast "Added to Later, not
   committed" shows at the bottom for 5 seconds with Undo; the top bar does not change.
6. **Given** the round page or a review page, **When** it opens, **Then** no ＋ shows anywhere.

### US7: Pages that never load forever (P2)

A link to a file that no longer exists shows "No file proposal.md in 2026-10-11-web-ui." with a link
to the feature, instead of loading forever. Astryx moves to 0.6.8, which keeps a page's state when
the window crosses 768 px.

Why this priority: small fixes on the pages this feature rewrites
([Q13](clarifications-01.md#q13-should-three-problems-found-outside-your-list-be-fixed-in-this-feature)).

Acceptance scenarios:

1. **Given** the feature `2026-10-11-web-ui`, finished into a record, **When** the human opens
   `/f/2026-10-11-web-ui/proposal.md`, **Then** the page shows "No file proposal.md in
   2026-10-11-web-ui." within 2 seconds, and the client sends no more than 2 requests for it.
2. **Given** a round with Q4's comment being typed in a window 800 px wide, **When** the window is
   narrowed to 700 px, **Then** the comment keeps its text and its focus.

## Edge cases

- **A round with no applicable question blank at first open**: Next reads "Submit" at once, and the
  round opens at its top, the last position aside.
- **A position saved on a question that no longer exists**, like a follow-up that stopped applying:
  the round opens at the first unanswered question.
- **`n` or `p` with no unanswered question in that direction**: nothing moves, and the bar's count
  does not change.
- **Two priority lines with the same text**: their addresses are `/priorities/<slug>` and
  `/priorities/<slug>-2`, in the file's order.
- **A task view whose line was removed elsewhere**: "This line is no longer in PRIORITIES.md.", with
  a link to the priorities page.
- **A task view whose line changes text elsewhere**: it is matched by its draft's path when it has
  one, and otherwise shows the removed-line message above.
- **An edit in place emptied**: Enter is refused, the line keeps its old text, and the field says "A
  priority cannot be empty."
- **An edit in place over a change made elsewhere**: the core refuses on the hash as today; the
  field keeps the typed text and shows "PRIORITIES.md changed on disk. Your change was not applied."
- **A drag dropped where it started, or cancelled with Escape**: nothing is written.
- **A drag on a list that changed under it**: the move is refused on the hash, the list reloads, and
  the message above shows.
- **Undo after the commit bar committed the deletion**: the toast is gone, since committing closes
  every toast of the priorities page; Discard no longer applies.
- **Undo of a deletion when the file changed since**: the line is inserted at its position in the
  file as it is now, at the end of its section if that position no longer exists.
- **Undo of ＋ after the line was edited**: Undo removes the line as edited.
- **A selected block taller than the space above the sheet**: its first line is placed at the top of
  the screen, under the bar.
- **The iOS keyboard opening in the comment sheet**: the sheet opens `tall`, which keeps the field
  above the keyboard, and the quoted lines in the sheet keep the context.
- **A draft whose priority line spans several sentences**: the whole line is both the title and
  What, as written.
- **A draft made by hand from the template, placeholders kept**: `ura start` refuses it as today.
- **The window crossing 768 px with a task view open**: the pane becomes a page, or the page a pane
  beside home, with the same address.
- **The window crossing 1024 px**: text and controls change size; nothing else moves.
- **Reduced motion**: the drag still follows the pointer, but lines jump instead of sliding, and
  scrolling to a question is instant.
- **No storage in a private window**: the round opens at the first unanswered question, as on a new
  browser.

## Success criteria

- **SC-001**: No file in `packages/web/src` imports a stylesheet other than Astryx's reset, core,
  and theme, and `styles.css` is gone.
- **SC-002**: `vp run ready` fails on a raw `button`, `input`, `textarea`, `select`, or `dialog`, a
  `style` prop, or a StyleX value that is not a token, unless the line carries a suppression with
  its reason.
- **SC-003**: On a 402 × 874 and a 1440 × 900 screen in WebKit, the home, round, review, task view,
  and priorities pages cut no text, never scroll sideways, and pass axe's WCAG 2.1 A and AA rules,
  in light and in dark.
- **SC-004**: On a 402 px touch screen, every control is at least 44 px tall and body text at least
  17 px; on a 1440 px screen, body text is 19 px.
- **SC-005**: From anywhere in a round, the next unanswered question is one tap or one key away.
- **SC-006**: Editing a priority line's text takes one tap on the line, then typing.
- **SC-007**: A link to a missing file settles in under 2 seconds, with at most 2 requests.

## Design

### Approach

The pages are rebuilt on the [UI components](../decisions/ui-components.md) decision: Astryx
components where they exist, and the app's own styles in StyleX, next to the component that uses
them, with Astryx's tokens only. `styles.css` goes, and with it every px size. The theme becomes the
app's own build of Astryx's neutral theme, extended with the [UI layout](../decisions/ui-layout.md)
decision's sizes: 17 px text on the phone, 19 px and controls grown by 1.2 from 1024 px wide, and 44
px controls under a coarse pointer. Layout follows two width classes split at 768 px: on wide
screens, a detail opens in a pane beside its list, menus are popovers, and short forms are dialogs;
on the phone, details are pages and menus and forms are sheets. Behaviour follows the
[UI behaviour](../decisions/ui-behaviour.md) decision, and the tests the
[UI checks](../decisions/ui-checks.md) decision ([discovery](discovery-01.md#how-the-ui-is-built)).

Navigation keeps the hand-written router, which gains per-entry state: the scroll position is saved
in the history entry before leaving, and restored once the page has drawn. A page keeps its content
on screen while its data reloads, instead of falling back to "Loading…"
([discovery](discovery-01.md#scroll-position-and-navigation-in-a-page)).

The core changes in two places: priority entries gain a stable `key` for the task view's address,
and an `insert` action for Undo; drafts lose their placeholders. Dragging uses `@dnd-kit/react`
([Q9](clarifications-01.md#q9-how-should-dragging-a-line-work)).

### Data

Nothing new is stored in the repository. The browser keeps two values.

**Priority entries**, in the core's [`priorities.rs`](/crates/core/src/files/priorities.rs) and the
binding's generated types, gain one field:

- `EntryItem.key: string`: the slug of the linked draft's file name when the line links a file under
  `specs/drafts/` (`cli-tuis` for `drafts/cli-tuis.md`), and otherwise the slug of the line's text,
  made by the core's [`slug::from_text`](/crates/core/src/slug.rs). A key already taken by an
  earlier entry of the file gets `-2`, `-3`, ... The task view's address is `/priorities/<key>`.

**Core action `priorities::insert(place, section, index, lines, previous) -> hash`**: writes the
given lines, an entry with its nested lines exactly as they were, at `index` of `section`, or at its
end when `index` is past it; refused on a hash mismatch, like the other priority actions. It backs
Undo of a deletion. `priorities::remove` returns the removed lines, its section, and its index,
which the UI keeps for the toast's Undo.

**Drafts**, from [`draft.rs`](/crates/core/src/actions/draft.rs): the proposal template with its
frontmatter, the line as the `#` title, the line again as the only paragraph of `## What`, and every
other bracketed placeholder line removed, leaving `## Why` and `## Notes` empty. The template's
guidance stays in the template, and the editor reads it from there for its hints, through a new
binding call `proposalHints() -> Record<"What" | "Why" | "Notes", string>`.

**History entries**: `history.state` holds `{ scroll: number }`, the page's scroll position, written
with `replaceState` before each navigation and on `pagehide`, at most once every 500 ms while
scrolling. `history.scrollRestoration` is `manual`.

**Browser storage**, in `localStorage`, each read and write guarded as the theme's is:

- `uraeda.theme`, as today.
- `uraeda.round.<folder>/<file>`: the id of the question at the top of the screen, like `Q9`,
  written at most once a second while scrolling a round.

### Components

- **Theme** ([`packages/web/src/theme/`](/packages/web/src/)): `defineTheme` extending
  `@astryxdesign/theme-neutral`, with adaptations: under a coarse pointer, element heights 44 px;
  from `lg` (1024 px), the type scale's base and element and spacing tokens raised by 1.2; a
  selection tint token of its own, distinct from the muted background. Built with
  `astryx theme build` into a committed stylesheet and theme object, as Astryx's docs recommend.
  `ThemeModeProvider` stays as is.
- **StyleX build** ([`packages/web/vite.config.ts`](/packages/web/vite.config.ts)): StyleX's Vite
  plugin compiles the app's `stylex.create` calls.
- **Lint** ([`vite.config.ts`](/vite.config.ts)): `react/forbid-elements` for `button`, `input`,
  `textarea`, `select`, and `dialog`, each with the Astryx component to use;
  `react/forbid-dom-props` and `react/forbid-component-props` for `style`; StyleX's lint plugin with
  `valid-styles` limited to tokens, scoped to `packages/web/src`.
- **Router** ([`routes.tsx`](/packages/web/src/routes.tsx)): routes gain
  `{ page: "task"; key: string }` at `/priorities/<key>`; `navigate()` saves the scroll position in
  the current entry first, and `useRestoreScroll(ready)` restores it on Back once `ready` is true.
  Pages keep their content during refetches through `useDeferredValue` on the route and fate's stale
  data, so `Suspense` shows "Loading…" only on a first load.
- **Shell** ([`Shell.tsx`](/packages/web/src/Shell.tsx)): `SideNavHeading` with `headingHref="/"`. A
  `TopBarSlot` context lets the current page put its own controls at the bar's end: home and the
  priorities page put ＋, the round puts its navigation on narrow screens. The theme switch stays at
  the navigation's end. A `Toast` viewport through the `AppShell`.
- **List-detail layout** (new, `Panes.tsx`): on wide screens, a list and a detail side by side, the
  detail at 40% of the width, at least 400 px; on narrow screens, the detail alone when the route
  names one. Used by home and the priorities page with the task view.
- **Adaptive overlay** (new, `Overlay.tsx`): one component for short forms, a `Dialog` on wide
  screens and a `BottomSheet` on narrow ones, with a visible Close and Back closing it. Menus use
  Astryx's `presentation="adaptive"` directly.
- **Home** ([`Home.tsx`](/packages/web/src/Home.tsx)): groups as `List` sections with `Item` rows;
  each priority row links to its task view; Draft and Start leave the row, for the task view.
- **Task view** (new, `TaskView.tsx`): reads the priorities and the linked draft; the line as an
  in-place editable field, a `SegmentedControl` for its section, Move up and down, Delete with the
  undo toast, Draft or the draft drawn with `Blocks`, Edit and Start, and ‹ Previous and Next ›
  within the section.
- **Priorities page** ([`PrioritiesPage.tsx`](/packages/web/src/PrioritiesPage.tsx)): sections as
  headings with counts, each a sortable list of `@dnd-kit/react`, with a handle on fine pointers and
  a 500 ms press on touch; rows edit in place; an "Add to <section>" row ends each section; the ⋯
  `MoreMenu` is adaptive; the commit bar stays. `dropIndex` stays, fed by dnd-kit's indices.
- **Editable line** (new, `EditableLine.tsx`): the line's spans, turning into a `TextInput` on tap:
  Enter saves, Escape cancels, blur saves. Shared by the priorities page and the task view.
- **Round** ([`RoundPage.tsx`](/packages/web/src/RoundPage.tsx), new `RoundNav.tsx`): the progress,
  Next, and the index from the questions the page already computes; on narrow screens, in the top
  bar, the index in a `BottomSheet`; on wide screens, a sticky column with Astryx's `Outline`, its
  items the applicable questions with their state; `n` and `p` through Astryx's `useHotkeys`. The
  position is saved and restored by question id. `Question.tsx` keeps its behaviour, restyled.
- **Review** ([`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx)): on narrow screens, the comment
  sheet opens `tall`, quotes the selected lines, and the page scrolls the selected block above it;
  on wide screens, the comment field is drawn in the page under the last selected block.
- **Editor** ([`EditorPage.tsx`](/packages/web/src/EditorPage.tsx)): a written draft or proposal
  opens drawn, with Edit; an empty section shows its hint from `proposalHints()`. Its discovery
  level control stays.
- **Document blocks** ([`Blocks.tsx`](/packages/web/src/Blocks.tsx)): restyled in StyleX; the
  feature and file pages gain `Breadcrumbs`.
- **Server** ([`sources.ts`](/packages/server/src/fate/sources.ts)): a file that cannot be read
  answers with a record marked missing, which the page shows as "No file …", instead of leaving the
  id out.
- **Core and CLI** ([`draft.rs`](/crates/core/src/actions/draft.rs),
  [`priorities.rs`](/crates/core/src/actions/priorities.rs)): the draft's content, `key`, and
  `insert`; `ura draft` writes through the same function.
- **Skill** ([`SKILL.md`](/skills/uraeda/SKILL.md)): the Draft step says the draft holds the line as
  its title and under What, with the template's headings and no placeholders, as the
  [CLI](../decisions/cli.md) decision requires.
- **Dependencies** ([`packages/web/package.json`](/packages/web/package.json)): Astryx core and
  neutral theme at 0.6.8, `@dnd-kit/react` at 0.5.0, StyleX's Vite and lint plugins, and `axe-core`
  for the tests, each pinned to an exact version.

### Mockups

- [UI improvements](mockups/ui-improvements.html), at 402 × 874 and 1440 × 900, light and dark:
  - the round on the phone, with its top bar, and its index sheet;
  - the round on desktop, with its sticky index column;
  - a review on the phone with the comment sheet and the block above it, and on desktop with the
    comment field under the block;
  - home on the phone, and on desktop with a task view in its pane;
  - the task view on the phone, without a draft and with a drawn draft;
  - the priorities page on the phone with a line being edited, a drag in progress, and the ⋯ sheet;
    on desktop with the popover menu;
  - a new draft in the editor, with its hints;
  - the toasts "Added to Later, not committed" and "Deleted "Nvim plugin"", each with Undo;
  - a missing file.

### Error handling

- **A save refused by the core**, from an edit in place, an add, or a move: the field keeps its
  text, or the list its order, and the message shows next to it, as today.
- **A change made elsewhere**: "PRIORITIES.md changed on disk. Your change was not applied.", the
  list reloaded, the typed text kept.
- **Undo after the toast's 5 seconds**: there is no toast; Discard in the commit bar still undoes
  every uncommitted change.
- **Undo refused**, when the file changed in a way the insert cannot follow: the toast is replaced
  by "Could not restore "Nvim plugin": PRIORITIES.md changed on disk."
- **A missing file**: "No file <name> in <folder>.", with a link to the feature.
- **A missing priority line**: "This line is no longer in PRIORITIES.md.", with a link to the
  priorities page.
- **The server unreachable, a hook's refusal, a conflicting answer**: as today.

### Testing

The integration tests render the app in happy-dom against a temporary git repository read through
the binding, as today ([helpers.tsx](/packages/web/src/__tests__/helpers.tsx)), and act like a user
through roles, labels, and text. The browser tests run the same app in WebKit, through Vitest's
browser mode, at 402 × 874 and 1440 × 900. Per the [UI checks](../decisions/ui-checks.md) decision,
each test guards a scenario or a decision's rule, and none checks markup, class names, or pixels
beyond the measures the decisions set.

| What                                                 | Test                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| US1 scenarios 1 to 5, 9, 10                          | `round.test.tsx`: the bar, Next, Submit, the index, reopening, a new browser |
| US1 scenarios 6, 7, 8                                | browser `round.test.tsx`: the column at 1440 px, `n` and `p`, Back to Q9     |
| US2 scenarios 1, 2                                   | browser `review.test.tsx` at 402 × 874: the block above the sheet, the quote |
| US2 scenarios 3, 4                                   | `review.test.tsx`: the field under the block on a wide screen, Cancel        |
| US3 scenarios 1 to 4, 6, 7                           | `task.test.tsx`                                                              |
| US3 scenario 5                                       | browser `task.test.tsx` at 1440 px                                           |
| US4 scenarios 1 to 4, 8, 9                           | `priorities.test.tsx`                                                        |
| US4 scenarios 5, 6, 7                                | browser `priorities.test.tsx`: drag with a mouse, a touch hold, the keyboard |
| US5 scenarios 1, 3, 4, 5                             | `editor.test.tsx`; core `draft` tests for the file's text                    |
| US5 scenario 2                                       | CLI `draft.rs`: the same bytes as the core's                                 |
| US6 scenarios 1 to 3                                 | browser `layout.test.tsx`, both sizes                                        |
| US6 scenarios 4 to 6                                 | `shell.test.tsx`                                                             |
| US7 scenario 1                                       | `missing.test.tsx`: the message, and the requests counted                    |
| US7 scenario 2                                       | browser `layout.test.tsx`: resize with focus kept                            |
| Edge cases: positions, `n`/`p` limits, no storage    | `round.test.tsx`                                                             |
| Edge cases: duplicate keys, removed or renamed lines | core `priorities` table-driven test of `key`; `task.test.tsx`                |
| Edge cases: empty edit, conflicts, Undo cases        | `priorities.test.tsx`; core tests of `insert`                                |
| Edge cases: cancelled drag, reduced motion           | browser `priorities.test.tsx`                                                |
| Edge cases: tall block, crossing 768 and 1024 px     | browser `review.test.tsx`, browser `layout.test.tsx`                         |
| Edge case: hand-made draft with placeholders         | core `start` tests, as today                                                 |
| SC-001, SC-002                                       | lint in `vp run ready`, and one lint fixture per banned pattern              |
| SC-003, SC-004                                       | browser `layout.test.tsx` with axe, both sizes, both themes                  |
| SC-005, SC-006                                       | US1 scenarios 2 and 7, US4 scenario 2                                        |
| SC-007                                               | `missing.test.tsx`                                                           |

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- "Uraeda" in the top bar links home, through `headingHref`.
- The confirmation after ＋ leaves the top bar: the line shows where it lands, or a toast says where
  it went. ＋ shows on home and the priorities page only, as your note asks.
- Back returns to the same scroll position, saved in the history entry and restored once the page
  has drawn, and pages keep their content while their data reloads.
- The selected block keeps a tint of its own, is scrolled above the comment field, and the field
  quotes its lines.
- Written drafts and proposals open drawn, with Edit; an empty new draft opens in the text editor.
- The task view's address comes from the linked draft, or else the line's text; previous and next
  walk the section.
- The feature and file pages show `Breadcrumbs`: home, feature, file.
- The UI decisions are one file per subject: components, layout, behaviour, and checks.
- Mockups of every changed view come with this spec, at both sizes.
- The proposal's cut sentence reads "put me back at the top".

Settled while writing this spec:

- The theme switch stays at the end of the navigation, which on the phone is the menu drawer:
  discovery wrongly called it hidden. Q13's A keeps only the Astryx upgrade and the missing file's
  fix.
- Forms: Q2's dialogs and Q3's modals are reconciled as "a short form may be modal: a dialog on wide
  screens, a sheet on the phone". The review's comment field avoids an overlay on wide screens by
  opening in the page, which [GitHub](discovery-01.md#commenting-on-a-range) does too.
- Body text 19 px from 1024 px, the `lg` width, rather than from 768 px: tablets between 768 and
  1024 px keep phone-sized text with the wide layout
  ([Q5](clarifications-01.md#q5-how-large-should-text-be-on-desktop)).
- The drag starts after a 500 ms press on touch, so a swipe scrolls; dnd-kit's guide uses 250 ms,
  which competes with scrolling on a long list.
- Undo lasts as long as the toast, 5 seconds, Astryx's default; deletion's Undo inserts the entry
  back through the new core `insert`, with its nested lines.
- `n` and `p` only on wide screens, never while a text field has the focus.
- The round's saved position is a question id, not pixels, so it survives a change of text size.
- Lint suppressions are allowed with a reason, for the cases Astryx cannot cover, like an option of
  a question: a full-width button holding paragraphs and lists, which no Astryx component draws.
- A new draft keeps the template's frontmatter, `discovery: high`, added to the template on main
  since discovery.

## Decisions

New, applied when this spec is approved:

- [UI components](../decisions/ui-components.md): Astryx components wherever one exists; the app's
  own styles in StyleX with Astryx tokens only; no global stylesheet; `@dnd-kit/react` for dragging;
  all enforced by lint.
- [UI layout](../decisions/ui-layout.md): two width classes at 768 px; side panes, popovers, and
  dialogs on wide screens, pages and sheets on the phone; 17 px text on the phone and 19 px from
  1024 px; left-aligned text.
- [UI behaviour](../decisions/ui-behaviour.md): whole rows tappable, edits in place, modals only for
  confirmations and short forms, inline status, 5 s toasts for unseen results, state kept on Back.
- [UI checks](../decisions/ui-checks.md): lint, layout and axe checks at a phone and a desktop size
  in `vp run ready`, tests that guard behaviour only, and reviewed screenshots before handover.

Relied on:

- [Stack](../decisions/stack.md): the UI stays React, Astryx, and fate, draws files from the core's
  document tree, and the draft's content lives in the core.
- [CLI](../decisions/cli.md): `ura draft` and the skill change with the core's draft.
- [Toolchain](../decisions/toolchain.md): the new checks run in `vp run ready`, and the new
  dependencies are pinned.

## Constitution check

| Principle                            | Complies | Notes                                                                                   |
| ------------------------------------ | -------- | --------------------------------------------------------------------------------------- |
| I. Humans stay in control            | yes      | The four decisions wait for this approval.                                              |
| II. Git and plain text first         | yes      | Only the reading position and the theme live in the browser, both temporary.            |
| III. Asynchronous by default         | yes      | Nothing changes in how steps are committed.                                             |
| IV. Review effort matches impact     | yes      | The round's navigation and the review's highlight serve the human's attention directly. |
| V. Tools are optional                | yes      | Drafts change in the core, `ura draft`, and the skill alike.                            |
| VI. Code is checked against the spec | yes      | Every scenario maps to a test; the new components are justified by the user stories.    |

## Risk tier

**Medium**: every page of the UI is rebuilt and two dependencies arrive, but no stored data changes
besides the text of new drafts, and no interface outside the UI changes.
