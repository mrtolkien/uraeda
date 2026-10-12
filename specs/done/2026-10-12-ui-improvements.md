---
kind: feature
finished: 2026-10-12
pull-request: https://github.com/mrtolkien/uraeda/pull/6
---

# Record: UI improvements

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-12, finished on
> 2026-10-12, in [its pull request](https://github.com/mrtolkien/uraeda/pull/6). Its full files are
> in git: `git log -- specs/2026-10-12-ui-improvements/`.

## What and why

The web UI had to become easier to use on both the phone and the desktop, "solely focused on
functionality": larger text on desktop, where the human zoomed to 120%, a place kept in a round of
questions, a task view for every priority, a priorities page that is not "a mess" behind a
mobile-only modal, drafts without placeholders to delete on a phone, and the commented block in view
during a review. It also had to set UI decisions, so that the next view is not "mostly good but also
very scuffed". While it was built, the Claude Code runner merged into main, and its views were
brought under the same rules.

## Behaviour

- **US1, a place kept in a round.**
  - On the phone, the top bar holds "Uraeda", a "6/12" button that opens the index in a sheet, Next,
    which goes to the next blank question and becomes "Submit" when none is left, and the menu.
  - On wide screens, a sticky 240 px "Questions" column shows "6 of 12 answered", Next or Submit, a
    progress bar, and the index, and `n` and `p` move between blank questions, never while a text
    field has the focus.
  - The index is a list of every applicable question and follow-up, marked ✓ or ○, titles wrapping,
    the question at the top marked current.
  - Back returns to the same scroll position on every page, and a page keeps its content while its
    data reloads. Opening a round again goes to the question left at the top on this browser
    (`localStorage` `uraeda.round.<folder>/<file>`), else to the first blank question.
  - The side navigation is collapsible and resizable, 240 px by default, its width remembered in the
    browser.
- **US2, commenting with the block in view.**
  - A selected block keeps a selection tint of its own.
  - On the phone, the comment sheet is non-modal and capped, the page scrolls the block just above
    it, and the sheet quotes the lines it comments on.
  - On wide screens, the comment field opens in the page under the block, with no overlay, and so do
    the edit of a pending comment and a general comment.
  - The feature page lists the feature's mockups. A mockup page shows one in a sandboxed frame, and
    while the spec waits for review, Comment adds a comment on the spec's line that links the
    mockup, or a general comment starting "Mockup <name>: ".
- **US3, a task view for every priority**, at `/priorities/<key>`.
  - A key is the slug of the linked draft's file name, else of the line's text, else `line`, with
    `-2`, `-3` for repeats over the whole file.
  - The view shows the line, edited in place, and its section, picked from Now, Next, Later, and
    Blocked, which moves the line to that section's end.
  - It shows Draft, or the draft drawn as a document with Edit and Start the feature, then Delete,
    with "Deleted "<line>"" and Undo for 5 seconds, and ‹ Previous and Next › through the section.
    It has no Move up or Move down.
  - On wide screens, it opens in a pane beside the home or priorities list it came from. On the
    phone, it is a page.
  - A line gone from the file shows "This line is no longer in PRIORITIES.md."
- **US4, grooming the priorities.**
  - Sections are headings with their count, "Now · 4", Now set apart.
  - A tap on a line opens its task view. The list has no ⋯ menu and no editing in place.
  - Each section ends with an "Add to <section>" row, which stays open for the next line.
  - Lines drag with `@dnd-kit/react`: by a handle with a mouse, by a 500 ms press on touch, or by
    the keyboard, with announced positions. Live updates wait until a drag ends, and Commit closes
    the page's toasts.
- **US5, drafts without placeholders.**
  - A draft, from the UI, `ura draft`, or the skill, holds the line as its title and under What,
    with empty Why and Notes sections and no placeholder.
  - The editor lists each empty section's guidance dimmed under the text area. A draft or proposal
    with text opens drawn as a document, with Edit.
  - `ura start` and the UI's Start accept any proposal, whatever its content.
- **US6, a desktop that reads right.**
  - From 1024 px wide, body text is 19 px, and controls and spacing grow by 1.2. The phone keeps 17
    px text, and controls are 44 px under a coarse pointer.
  - The reading column is capped at `60ch`, about 70 characters of its font, and text is
    left-aligned with `text-wrap: pretty`, never justified.
  - "Uraeda" in the side navigation links home, a ⌂ icon while the navigation is folded. The feature
    and file pages show breadcrumbs: home, feature, file.
  - ＋ shows on home and the priorities page only. It confirms with "Added to <section>, not
    committed" and Undo, in a 5-second toast, and the top bar does not change.
  - A refused Undo shows "Could not restore …" in a banner under the top bar until dismissed.
- **US7, pages that never load forever.**
  - A missing file shows "No file <name> in <folder>." with a link to the feature, in at most 2
    requests.
  - Astryx is 0.6.8, which keeps a page's state when the window crosses 768 px.
- **US8, the agent's runs at both widths.**
  - The feature page's Agent section shows:
    - the latest run's state, time, cost, and failure reason;
    - its blocked actions, with Allow and continue under the command;
    - Stop, Start the agent, or Try again;
    - a Runs list, newest first.
  - A row opens the run view at `/f/<folder>/runs/<id>`: a pane beside the feature page on wide
    screens, a page on the phone. A run of another feature shows "No run <id> in <folder>.", and a
    feature that does not exist "No feature <folder>.".
  - The tool-call groups the human opened stay open on Back and on reload, but a single call's
    output does not.
  - The log follows its end while the human is at the end. A call left running by an ended run shows
    as failed, "Not finished: the run ended.".

## Design

The pages were rebuilt on Astryx 0.6.8 components, with the app's own styles in StyleX using
Astryx's tokens only. `styles.css` is gone, and lint enforces both. The theme is the app's own build
of Astryx's neutral theme, whose adaptations set the sizes by width and pointer. The layout follows
two width classes split at 768 px: on wide screens, details in panes, menus as popovers, and short
forms as dialogs; on narrow screens, pages and sheets. The hand-written router gained per-entry
state for scroll positions and open items. The core gained priority keys, an insert action for Undo,
features' mockup lists, and placeholder-free drafts.

**Foundations:**

- **Theme:** [`packages/web/src/theme/theme.ts`](/packages/web/src/theme/theme.ts), built with
  `astryx theme build` into the committed [`theme/built/`](/packages/web/src/theme/built/). It holds
  the reading sizes, the selection colours, the 1.2 growth from `lg`, 44 px controls under a coarse
  pointer, and the `chat-tool-calls` override that wraps tool names.
- **StyleX and lint:** StyleX's Vite plugin in
  [`packages/web/vite.config.ts`](/packages/web/vite.config.ts). The lint rules
  (`react/forbid-elements`, `style` and `className` banned, StyleX's `valid-styles`) are in
  [`vite.config.ts`](/vite.config.ts), with StyleX's plugin wrapped by
  [`packages/web/lint/stylex.js`](/packages/web/lint/stylex.js) and one fixture per banned pattern
  in [`__lint__/`](/packages/web/src/__lint__/).
- **Layout pieces,** in [`packages/web/src/layout/`](/packages/web/src/layout/):
  - [`useWidthClass.ts`](/packages/web/src/layout/useWidthClass.ts), the one source of the width
    class;
  - [`Panes.tsx`](/packages/web/src/layout/Panes.tsx), a list and its detail;
  - [`Overlay.tsx`](/packages/web/src/layout/Overlay.tsx), a dialog or a sheet by width, with Close
    and Back;
  - [`TopBarSlot.tsx`](/packages/web/src/layout/TopBarSlot.tsx), a page's controls in the shell's
    header;
  - [`useUndoToast.ts`](/packages/web/src/layout/useUndoToast.ts), the 5-second toast with Undo and
    the banner of a refused Undo;
  - [`Page.tsx`](/packages/web/src/layout/Page.tsx) and
    [`Paragraph.tsx`](/packages/web/src/layout/Paragraph.tsx), the page's column and its reading
    text.
- **Router:** [`routes.tsx`](/packages/web/src/routes.tsx). `navigate` saves the scroll position in
  the history entry, `RouterAnchor` records where every link was followed from, and the routes
  include `task` and `run`. [`App.tsx`](/packages/web/src/App.tsx) puts the task view or the run
  view beside its list on wide screens.
- **Shell:** [`Shell.tsx`](/packages/web/src/Shell.tsx), with the home link, the collapsible
  navigation, and the Undo banner, and [`QuickAdd.tsx`](/packages/web/src/QuickAdd.tsx) for ＋.

**The pages:**

- **Home and the task view:** [`Home.tsx`](/packages/web/src/Home.tsx),
  [`TaskView.tsx`](/packages/web/src/TaskView.tsx), and
  [`EditableLine.tsx`](/packages/web/src/EditableLine.tsx), shared with the Add rows.
- **Priorities:** [`PrioritiesPage.tsx`](/packages/web/src/PrioritiesPage.tsx), where `dropMove`
  turns dnd-kit's order into the core's `dropIndex`.
- **Round:** [`RoundNav.tsx`](/packages/web/src/RoundNav.tsx) and
  [`useRoundPosition.ts`](/packages/web/src/useRoundPosition.ts), in
  [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx).
- **Review and mockups:** [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx),
  [`CommentForm.tsx`](/packages/web/src/CommentForm.tsx),
  [`MockupPage.tsx`](/packages/web/src/MockupPage.tsx), and
  [`Blocks.tsx`](/packages/web/src/Blocks.tsx), whose selectable block is a toggle laid under its
  text, so its links stay links.
- **Editor:** [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx), with the hints from the
  binding's `proposalHints()`.
- **Runs:** [`AgentPanel.tsx`](/packages/web/src/AgentPanel.tsx),
  [`RunPage.tsx`](/packages/web/src/RunPage.tsx), and [`RunLog.tsx`](/packages/web/src/RunLog.tsx).
- **Breadcrumbs and missing files:** [`Crumbs.tsx`](/packages/web/src/Crumbs.tsx), and
  [`FilePage.tsx`](/packages/web/src/FilePage.tsx) over a missing record from the server's
  [`fate/sources.ts`](/packages/server/src/fate/sources.ts).

**The core and the checks:**

- **Drafts:** [`actions/draft.rs`](/crates/core/src/actions/draft.rs) and
  [`embedded.rs`](/crates/core/src/embedded.rs) (`proposal_hints`).
  [`actions/start.rs`](/crates/core/src/actions/start.rs) lost its content check.
- **Priorities:** `keys` and `insert_entry` in
  [`files/priorities.rs`](/crates/core/src/files/priorities.rs), and `insert` in
  [`actions/priorities.rs`](/crates/core/src/actions/priorities.rs).
- **Layout checks:** the WebKit tests at 402 × 874 and 1440 × 900, with axe-core in light and dark,
  in [`packages/web/src/__browser__/`](/packages/web/src/__browser__/), on the phone instance with a
  touch screen of [`vite.browser.config.ts`](/packages/web/vite.browser.config.ts).
- **Screenshots:** [`packages/web/scripts/screenshots.ts`](/packages/web/scripts/screenshots.ts)
  takes them for review, into the `screenshots/` of the feature's folder it is given.

## Questions

### Round 01

#### Q1: How should this app's UI be built?

**Answer:** A: Astryx components wherever one exists, the app's own styles in StyleX with Astryx's
tokens only, no global stylesheet, and lint to enforce it.

#### Q2: How should the UI adapt between the phone and the desktop?

**Answer:** A: two width classes split at 768 px. On wide screens, details open in side panes, menus
are popovers, and forms are dialogs; on the phone, details are pages and menus and forms are sheets,
with an open item in the URL.

#### Q3: Which rules should govern how the UI behaves?

**Answer:** A: a behaviour decision: whole rows tappable, small edits in place, modals only for
confirmations, a visible close and Back on every overlay, status next to its control, 5-second
toasts with Undo for unseen results, errors that stay, and Back keeping the place.

#### Q4: What checks an agent's UI work?

**Answer:** A: lint, layout checks at a phone and a desktop size, and axe-core in both themes in
`vp run ready`, plus screenshots reviewed before handover: "I'm down for tests but they should be
useful: each test is added maintenance, because tests also drift away from expected behaviour".

#### Q5: How large should text be on desktop?

**Answer:** A: 19 px body text from 1024 px wide, with controls and spacing grown by the same 120%
through Astryx's theme; the phone keeps 17 px.

#### Q6: Should paragraphs be justified?

**Answer:** C: left-aligned with `text-wrap: pretty` everywhere.

#### Q7: What does tapping a task on home open?

**Answer:** A: a task view at its own address, a side pane on wide screens and a page on the phone.

#### Q8: How are lines edited and added on the priorities page?

**Answer:** A: tap to edit in place, an "Add" row per section, and a ⋯ menu for the rest; the spec
review's C3 later replaced the tap and the menu with the task view.

#### Q9: How should dragging a line work?

**Answer:** A: `@dnd-kit/react`, with a handle on desktop and a press-and-hold on the phone, pinned.

#### Q10: What should a new draft hold?

**Answer:** B: the line as the title and also under What, with the template's headings: "on a phone
deleting the placeholder text was annoying. I'm ok with keeping headings", and "proposals are also
pretty freeform".

#### Q11: How do you move through a round of questions?

**Answer:** A, with the navigation in the phone's existing top bar: "We should put our outline/index
in that bar. We don't lose any space compared to the current layout".

#### Q12: Where does a round open when you come back to it?

**Answer:** A: where it was left on this browser, and the first unanswered question otherwise.

#### Q13: Should three problems found outside your list be fixed in this feature?

**Answer:** A: all three; the spec found the theme switch was never hidden on the phone, so the
missing file's loop and the Astryx 0.6.8 upgrade remained.

#### Notes

＋ is not needed while answering questions: priorities are added "either from home (for quick saving
of ideas) or the priorities page".

## Decisions

- [UI components](../decisions/ui-components.md), new: Astryx first, StyleX with tokens only, no
  global stylesheet, `@dnd-kit/react` for dragging, pinned versions, all enforced by lint.
- [UI layout](../decisions/ui-layout.md), new: two width classes at 768 px, panes and popovers on
  wide screens, pages and sheets on the phone, 17 px and 19 px text, left-aligned.
- [UI behaviour](../decisions/ui-behaviour.md), new: whole rows tappable, edits in place, modals
  only for confirmations and short forms, inline status, 5-second toasts, the place kept on Back.
- [UI checks](../decisions/ui-checks.md), new: tests that guard behaviour only, layout and axe
  checks at two sizes in `vp run ready`, and screenshots reviewed before handover.

## Changes after approval

The spec review's comments, carried out by the plan:

- **C1:** mockups are viewable inside the UI, and commentable while the spec waits for review.
- **C2:** `ura start` accepts any proposal, "this is the part of the workflow that's the most
  human-driven, it needs to be freeform". It replaced US5's refused start.
- **C3:** the side navigation is collapsible and resizable, the task view has no Move up or Move
  down, and on the priorities page a tap opens the task view, with no ⋯ menu and no editing in
  place.

Spec revision 2, asked by the human in chat once the Claude Code runner merged into main:

- **US8:** the Agent section stays short, with a run view in a pane or a page.
- **A refused Undo** shows in a banner that stays until dismissed, not only in a toast.

Rulings that change behaviour:

- **Undo:** ＋'s Undo removes the line it added by its text, and says so once it is edited or gone
  (R9). A deletion's Undo inserts over the file as it is now (R11).
- **The task pane** shows home or the priorities page beside it, by where it was opened from (R12).
- **The editor's hints** are listed under the text area, not drawn on the empty sections (R13).
- **The round's index** is a list with wrapping titles, not Astryx's `Outline`, which cuts them
  (R15).
- **The comment sheet** is capped and non-modal, so the block shows above it and a second tap
  extends the selection (R17).
- **On wide screens,** an edited or general comment is also written in the page (R18).
- **A review's block** is selected through a toggle under its text, so its links stay links (R20).
- **The navigation's heading** is the app's own link home, with a ⌂ icon while folded (R21).
- **The checks:** dark secondary text is `#a8a8a8`, the reading measure is `60ch`, and rows, crumbs,
  switches, and segments are a control's height under touch (R22).
- **The runner's views:** they moved to Astryx and StyleX, and a run's status shows next to its
  control, never as a toast (R24).
- **A run view** keeps its opened groups on Back and reload, but not a single call's output (R26).

## Follow-ups

The final review's minor findings, deferred (R25):

- **Overlay history entries** are left behind when an overlay unmounts, on navigation, on a resize
  across 768 px, or on a reload.
- **The pane's Close** puts the list back at its top, not where it was.
- **After a rename,** the task view can fall back to the line now at the old line's id.
- **A rename refused on the hash** does not reload the list.
- **A mockup's line** is matched on its link as written, not on its resolved path.
- **Untested edge cases:**
  - reduced motion, and crossing 1024 px;
  - `n` and `p` with nothing in that direction, and a full round opening at its top against the
    saved position;
  - a drop where the drag started, and a drag refused on the hash;
  - a task-view edit refused on a conflict, Undo of ＋ after an edit, and a renamed line matched by
    its draft.
- **Weak assertions:** US2's second tap above the sheet, US1 8 masked by the saved position, US1 2
  and 3 checking focus only, and the toasts' 5 seconds.
- **Fixed sleeps** in the browser tests.
- **A markup query,** `closest("section")`, in `__browser__/round.test.tsx`.
- **Pages missing from the two-size checks:** the editor, the mockup page, a plain document, a
  missing file, the open index sheet, and the ＋ dialog.
- **Screenshots missing:** the task view without a draft, the Deleted toast, the feature page with
  mockups and breadcrumbs, and the round's phone top bar.
- **The lint fixtures** cover one pattern per rule, and `valid-styles` accepts any `var()`.
- **The theme's `!important`** for `ChatToolCalls` is not listed as an Astryx gap.
- **The question option's raw button,** holding links, could nest interactive content.
- **Dead code:**
  - `useRestoreScroll`'s always-true argument;
  - exports used only in their file;
  - the duplicated `reducedMotion()` and band styles.

The review of the agent's runs, deferred (R27):

- **A run's row** tapped before the feature's live update lists the run can show "No run" until the
  update arrives.
- **Opening a run's row** remounts the feature page beside it, so a refusal shown in its Agent
  section goes, as with the task view beside its list.
- **Untested:** US8 4's Back half, US8 2's scroll position on Back, a run started while its view is
  open, and crossing 768 px with a run view open.
- **Focus** goes to the page's body when an Undo banner is dismissed.

Raised on the pull request:

- **Repeated lines' keys** follow their order: once one of two lines with the same text is moved
  above the other or deleted, `-2` names the other line, and an open or bookmarked task view shows
  it. Lines told apart by nothing but their place need an id written in the file to keep theirs.

Work left:

- **An Astryx gap:** `ChatToolCalls` keeps each call's output open in its own state, so a run view
  cannot restore it (R26).
