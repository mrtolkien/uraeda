---
status: awaiting-human
---

# Clarifications, round 01: UI improvements

> [!IMPORTANT]
>
> 13 questions on the UI improvements, about 45 minutes.
>
> - The first four questions shape the UI decisions you asked for, outlast this feature, and work
>   together: how the UI is built, how it adapts to the phone and the desktop, how it behaves, and
>   what checks an agent's UI work. The first costs the most: every page's styles move off the
>   global stylesheet.
> - Two answers go against what the proposal asks:
>   - Breadcrumbs are for a page's parents. What you describe for questions is an index with a "next
>     unanswered" button, so that is what is offered.
>   - Every source read warns that justified text is at its worst on a phone. You still get the
>     choice.
> - Reordering by drag with animation needs a new dependency, `@dnd-kit/react`, which is pre-1.0.
> - Drafts without placeholders change `ura draft` and the skill too, not only the UI.
> - Three problems found outside your list are offered for this feature at the end: a page that
>   loads forever, a theme switch hidden on the phone, and an Astryx upgrade.
> - The proposal's sentence about coming back to the questions stops at "put me back at the": read
>   as "the top".
> - 10 points are settled without you, at the end.

## Context

The [proposal](proposal.md) asks for a smoother web UI, focused on function:

- larger text on desktop;
- home tasks that open a task view;
- drafts without the template's placeholders;
- question navigation, and keeping your place in a round;
- justified paragraphs;
- the reviewed block highlighted while you comment;
- a top bar that links home and is not pushed around by ＋;
- a priorities page that works on desktop.

It also asks for UI decisions, so views stop ending up "mostly good but scuffed".

Today, the pages share 533 lines of global CSS in px ([styles.css](/packages/web/src/styles.css)).
Their text is 17 px on the phone and 16 px on desktop. Every overlay is Astryx's `BottomSheet`,
which on desktop is a 640 px sheet rising from the bottom of the screen. Navigating always scrolls
to the top, and Back lands at the top because the page shows "Loading…" while its data reloads
([routes.tsx](/packages/web/src/routes.tsx)). The [web UI's spec](../done/2026-10-11-web-ui.md)
named Astryx components that were not used in the end, like `Outline`, `Toast`, and `List`, and no
rule or check caught it.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: How should this app's UI be built?

The pages use a few Astryx components, and draw everything else with global classes in px:

- rows, bands, options, and sheets' content;
- the review's blocks.

Astryx has components for much of it, like `List`, `Item`, `Heading`, `Text`, `Outline`, and
`Toast`, and tokens for every size and colour. Its styles are written in StyleX. Design systems
enforce "use the component" and "use the tokens" with lint rules. oxlint, which `vp check` already
runs, has rules to ban a raw element with a message naming its replacement, and to ban `style`
props. This answer becomes a decision, and Q4 decides how it is checked. More in
[discovery](discovery-01.md#how-the-ui-is-built).

Why it matters: it decides what every agent writes for every future view, and how much of today's UI
is rewritten now.

- **A (recommended). Astryx components wherever one exists. The app's own styles, like the reading
  layout's bands and options, are written in StyleX with Astryx's tokens only. No global stylesheet
  remains but Astryx's theme. Lint bans raw elements that have an Astryx component, `style` props,
  and raw values in StyleX. A missing component is reported in the plan, not hand-rolled silently.**
  - [pro] one vocabulary: sizes and colours follow the theme, light and dark, and Q5's text size
    applies everywhere at once.
  - [pro] an agent gets a precise lint message instead of a taste to guess.
  - [con] every page's styles move from `styles.css` to StyleX in this feature, the largest part of
    its work.
  - [con] StyleX's lint plugin runs through oxlint's JavaScript plugins, which are in alpha.
  - Why recommended: the web UI's spec named the right components and the pages drifted anyway. Only
    a check holds the line.
- **B. Astryx components wherever one exists, checked by lint, but the reading layout's classes stay
  in one global stylesheet, rewritten with tokens instead of px.**
  - [pro] much less to rewrite; the reading layout stays in one readable file.
  - [con] two ways to style, and nothing checks the global file's values.
- **C. Written guidelines only, in the decision, with no lint.**
  - [pro] nothing to set up.
  - [con] the situation that produced today's pages.

**Answer:**

## Q2: How should the UI adapt between the phone and the desktop?

Today the desktop shows the phone's single column, 720 px wide, with phone sheets. Established
products open an item in a side panel next to its list on desktop, and in a full page on a phone:
Todoist, Jira, GitHub Projects. Menus and short forms become popovers or dialogs on desktop.
Astryx's menus have an `adaptive` mode that does this switch: a sheet on a phone, a popover
elsewhere. Its dialogs and sheets do not switch by themselves. Astryx's shell already switches at
768 px. This answer becomes a decision, and the task view (Q7) and the round's index (Q11) follow
it. More in [discovery](discovery-01.md#adapting-to-the-phone-and-the-desktop).

Why it matters: it decides whether desktop is a first-class layout or a stretched phone, and what
every future view has to provide at each size.

- **A (recommended). Two width classes, split at Astryx's 768 px. On wide screens, a detail opens in
  a side pane next to its list, menus are popovers, and forms are dialogs. On the phone, details are
  pages, and menus and forms are sheets. Every view states its layout at both sizes in its spec, and
  an open item lives in the URL, so a reload or Back keeps it.**
  - [pro] desktop stops being "mobile-only", which the proposal names for the priorities page.
  - [pro] one rule for every overlay, chosen by width, never by device type.
  - [con] a pane layout and an adaptive overlay to build, and two layouts to check per view.
  - Why recommended: it matches how the products you would compare against behave, and Astryx
    already switches at that width.
- **B. One column everywhere, wider and with larger text on desktop. Bottom sheets become centred
  dialogs on wide screens.**
  - [pro] small, and one layout to check.
  - [con] the desktop's width stays unused: a task view covers the list it came from.
- **C. As today: the same layout and sheets everywhere.**
  - [pro] nothing to build.
  - [con] the desktop problems the proposal lists stay.

**Answer:**

## Q3: Which rules should govern how the UI behaves?

The proposal's problems are behaviour as much as looks:

- a simple edit hidden behind a modal;
- a confirmation that takes the top bar's place;
- a reading position lost on Back.

Design systems write rules for these:

- modals only for irreversible actions or input needed to continue (NN/g, Atlassian);
- status shown inline next to its control, and toasts only for short confirmations
  ([Pajamas](https://design.gitlab.com/patterns/saving-and-feedback));
- a visible close button and Back on every sheet
  ([NN/g](https://www.nngroup.com/articles/bottom-sheet/));
- state kept in the URL ([Vercel](https://vercel.com/design/guidelines)).

Primer avoids toasts altogether for accessibility
([Primer](https://primer.style/accessibility/toasts)). This answer becomes a decision. More in
[discovery](discovery-01.md#how-the-ui-behaves).

Why it matters: these rules decide how every future action feels, and they are where today's pages
went wrong.

- **A (recommended). A behaviour decision: a row that leads somewhere is tappable as a whole, and a
  small edit, like a line's text, happens in place; modals only confirm irreversible actions, and
  every sheet and dialog has a visible close button and closes on Back; a save's status shows next
  to its control, a toast of 5 seconds, which may carry Undo, confirms only a result you cannot see,
  and errors stay until dealt with; Back returns to the same scroll position and open items; nothing
  works only on hover.**
  - [pro] each rule answers one of the proposal's problems, and most can be tested.
  - [con] Undo in a toast goes against Pajamas' "no actions in toasts"; it is limited to undoing the
    change just made.
  - Why recommended: it turns the proposal's complaints into rules the next view cannot break.
- **B. The same rules, without toasts: confirmations show inline only, like Primer.**
  - [pro] no timed message, the most accessible.
  - [con] ＋ from another page has nowhere to confirm, and Undo needs another place.
- **C. No behaviour decision: each spec settles its own.**
  - [pro] nothing to maintain.
  - [con] the next view decides again, as this one did.

**Answer:**

## Q4: What checks an agent's UI work?

Today one test checks the home, round, review, plan, and priorities pages, at an iPhone's size, in
WebKit ([layout test](/packages/web/src/__browser__/layout.test.tsx)): no text cut and no sideways
scroll. Nothing checks the desktop. Teams add:

- lint rules, for Q1;
- layout checks at several sizes, for Q2;
- axe-core scans for accessibility in each theme;
- screenshots, either reviewed by a person or compared pixel by pixel.

Pixel comparisons break across operating systems and fonts, and Vitest advises making their
reference images in CI only. That would make a green local run differ from CI, against the
[toolchain decision](../decisions/toolchain.md)'s promise, except as a CI-only check, which it
allows. This answer becomes a decision. More in
[discovery](discovery-01.md#how-the-rules-are-checked).

Why it matters: it decides what "done" means for UI work, and what you look at before approving it.

- **A (recommended). `vp run ready` runs lint, layout checks at a phone size (402 × 874) and a
  desktop size (1440 × 900), and axe-core in light and dark. Before handing over, the agent also
  takes screenshots of every changed view at both sizes and in both themes, reviews them against the
  decisions, and attaches them to the pull request.**
  - [pro] deterministic checks, plus looks reviewed by the agent and by you.
  - [con] a visual slip no rule names is caught only by the review of the screenshots.
  - Why recommended: it keeps local and CI runs the same, and gives you the pictures to judge.
- **B. A, plus pixel comparisons of the screenshots in CI, with their reference images made in CI.**
  - [pro] any visual change is flagged.
  - [con] reference images to update with every intended change, and failures that only CI shows.
- **C. Lint and today's phone test only.**
  - [pro] nothing new to run.
  - [con] the desktop stays unchecked.

**Answer:**

## Q5: How large should text be on desktop?

Today text is 17 px on the phone and 16 px on desktop, and you zoom the desktop to 120%, which makes
it about 19 px and scales the controls too. GOV.UK sets body text to 19 px everywhere, and Apple's
iOS body is 17 pt.

Astryx's text sizes are in rem, but its control heights and spacing are in px. Raising the text size
therefore leaves buttons and fields as they are. Astryx's theme can change both by width, through
its `adaptations`. CSS `zoom` scales everything at once, but throws off code that measures
positions, like dragging (Q9). More in [discovery](discovery-01.md#desktop-text-size).

Why it matters: it decides whether the desktop looks right without zooming, and how sizes are
written from now on.

- **A (recommended). From 1024 px wide, body text is 19 px, and control heights and spacing grow by
  the same 120%, all through Astryx's theme. The phone keeps 17 px text. Every size is written in
  the theme's units, and the reading column is capped at about 70 characters.**
  - [pro] the desktop looks like your 120% zoom, without zooming.
  - [pro] one place sets every size.
  - [con] a theme to build and tune, rather than the prebuilt one.
  - Why recommended: it matches what you already chose by zooming, in a way the decisions can hold.
- **B. Text only: 19 px from 1024 px wide; controls keep their size.**
  - [pro] simpler, nothing but type changes.
  - [con] large text next to small buttons.
- **C. CSS `zoom: 1.2` on the page from 1024 px wide.**
  - [pro] exactly your zoom, in one line.
  - [con] breaks the dragging library's position math, and nested zooms compound.

**Answer:**

## Q6: Should paragraphs be justified?

You asked for justified paragraphs, as they look better on mobile. Every source read warns that the
phone is where justification goes worst:

- About 40 characters fit in a line at 402 px, so the gaps between words widen into "rivers".
- Safari cannot tune how it justifies.
- A word that cannot break, like inline code or a link, stretches the line before it.

WCAG asks for text that is not justified only at its strictest level, AAA, which the app does not
claim, so AA stays met. Hyphenation narrows the gaps, and the page already declares its language.
More in [discovery](discovery-01.md#justifying-paragraphs).

Why it matters: it is a taste choice with a readability cost, and it applies to every document the
UI shows.

- **A (recommended). Justify paragraphs everywhere, with hyphenation on and the last line
  left-aligned. Lists, tables, code, headings, and the answer line stay left-aligned, and code and
  links are never hyphenated.**
  - [pro] what you asked for, with the mitigations every source names.
  - [con] some phone lines will show wide gaps, mostly around inline code.
  - Why recommended: it is your preference, AA is kept, and it is one style rule to revert if it
    reads badly.
- **B. Justified from 768 px wide only. On the phone, left-aligned with `text-wrap: pretty`, which
  evens out line lengths.**
  - [pro] justification where lines are long enough for it.
  - [con] not on the phone, where you asked for it.
- **C. Left-aligned with `text-wrap: pretty` everywhere.**
  - [pro] what every source advises.
  - [con] not what you asked for.

**Answer:**

## Q7: What does tapping a task on home open?

Home's priority lines do nothing when tapped. Their actions are spread out:

- Draft and Start buttons on home, where Start opens the editor;
- a menu on the priorities page;
- the editor, which shows raw markdown.

Todoist's task view holds a task's text, its section, its actions, and its description. It opens in
a side panel on the web and as a page on a phone, with previous and next. Where the view opens
follows Q2. More in [discovery](discovery-01.md#the-task-view).

Why it matters: it becomes the one place to act on a priority, from home and from the priorities
page.

- **A (recommended). A task view for a priority line, at its own address. It shows the line,
  editable in place, and its section, with Move and Delete. It also shows its draft drawn as a
  document, with Edit and Start the feature, or Draft when it has none. With A in Q2, it is a side
  pane on wide screens and a page on the phone.**
  - [pro] every action on a line in one place, and drafts read as documents, as you asked.
  - [con] a new view and address; lines have no stable id today (settled below).
  - Why recommended: it is what "a task view with all the options" describes, and how Todoist does
    it.
- **B. The line expands in place on home, with its actions under it.**
  - [pro] small, no new page.
  - [con] no room for the draft's text, and home grows with each opened line.
- **C. Tapping opens the draft's editor, drafting the line first when it has none.**
  - [pro] the smallest change.
  - [con] moving, editing, and deleting stay elsewhere.

**Answer:**

## Q8: How are lines edited and added on the priorities page?

Today the priorities page hides every action, even a one-word fix, behind a sheet of buttons, and
lines are added only through ＋. In established products:

- small edits happen in place: Trello's `t`, GitHub Projects' Enter;
- new items are added in an "Add" row at the end of each section: Trello, GitHub Projects, Todoist;
- a "Move to…" menu is the main way between sections on phones.

Todoist is the exception: it opens its task view instead of editing in place. This answer uses the
task view of Q7. More in [discovery](discovery-01.md#editing-priorities).

Why it matters: the priorities page is where you groom the backlog, and each extra tap adds up.

- **A (recommended). Tapping a line's text edits it in place: Enter saves, Escape cancels. Each
  section ends with an "Add" row. The other actions are in a ⋯ menu, a popover on desktop and a
  sheet on the phone: move up, move down, move to a section, open the task view, delete. Sections
  are headings with their count, and Now stands out.**
  - [pro] one tap for the most common change, and adding happens where the line goes.
  - [con] a tap on the text no longer opens anything, so the task view is a menu item here.
  - Why recommended: it fixes what the proposal names, "can't tap the task to edit it" and "can't
    easily add a line", with patterns users know.
- **B. Tapping a line opens the task view of Q7, where everything happens, as on home.**
  - [pro] one behaviour on both pages.
  - [con] two taps and a view change for a one-word fix.
- **C. Today's page, with the sheet replaced by an adaptive menu.**
  - [pro] small.
  - [con] editing still takes two taps and a field in an overlay.

**Answer:**

## Q9: How should dragging a line work?

Today's hand-written drag moves nothing while you drag: the line jumps on release. Astryx has no
reordering component. The options:

- `@dnd-kit/react` moves the other lines out of the way as you drag, works with touch and the
  keyboard, and announces moves to screen readers. It is 33 kB and still pre-1.0, at 0.5.
- Animating without a library animates a move only once it is made.
- Atlassian's guidelines recommend menu actions as the accessible path in any case.

A new dependency lasts beyond this feature. More in
[discovery](discovery-01.md#reordering-priorities).

Why it matters: it decides how reordering feels on both devices, and adds a dependency to keep up
with.

- **A (recommended). Use `@dnd-kit/react` for dragging, with a handle on desktop and a
  press-and-hold on the phone. The menu's move actions stay for the keyboard and for moving between
  sections. The version is pinned, and upgrades are deliberate.**
  - [pro] the drag animates as in Things or Todoist, on touch and with a mouse.
  - [con] a pre-1.0 dependency whose API may change.
  - Why recommended: a drag that animates well on touch is a lot of code to write and test by hand,
    and dnd-kit is the maintained choice for React 19.
- **B. Keep the hand-written drag, and add a drop indicator and an animation once the line lands.**
  - [pro] no dependency.
  - [con] nothing moves under your finger, and the touch edge cases stay ours.
- **C. Drop dragging: move up, move down, and move to a section, each animated.**
  - [pro] no dependency, simple, accessible.
  - [con] reordering far takes many taps.

**Answer:**

## Q10: What should a new draft hold?

Draft writes the proposal template with the line as its title, placeholders included ("[What the
feature does, from the user's point of view.]"), and you delete them by hand. `ura start` refuses a
draft that still has them, or whose What or Why is empty
([draft.rs](/crates/core/src/actions/draft.rs), [start.rs](/crates/core/src/actions/start.rs)).
`ura draft` and the [skill](/skills/uraeda/SKILL.md) do the same, so a change here changes them too,
as the [CLI decision](../decisions/cli.md) requires. More in
[discovery](discovery-01.md#what-a-new-draft-holds).

Why it matters: every feature starts from a draft, written from the UI and the CLI alike.

- **A (recommended). The line as the title, then the template's headings with empty sections. The
  editor shows each section's guidance as a dimmed hint, which is not in the file. `ura draft` and
  the skill write the same.**
  - [pro] nothing to delete; `ura start` still refuses a draft with an empty What or Why.
  - [con] the guidance is gone from the file for someone editing it by hand.
  - Why recommended: it is exactly what the proposal asks, and keeps the guard.
- **B. As A, with the line's text also written under What.**
  - [pro] a long line, like "Discovery effort level in proposal -> ...", is kept in full as a start.
  - [con] What is never empty, so `ura start` can no longer tell an unwritten draft.
- **C. Keep the placeholders in the file; the editor shows them dimmed.**
  - [pro] no change to the CLI or the skill.
  - [con] the placeholders are still there to delete.

**Answer:**

## Q11: How do you move through a round of questions?

You asked for "breadcrumbs" to jump to the next unanswered question and to move through the
questions and follow-ups. Breadcrumbs list a page's parents. A position within a page is shown by an
index, like Google Docs' outline or Notion's floating one, or by "next open item", like GitLab's `n`
and `p`. Astryx's `Outline` is that index, and its `Breadcrumbs` will instead serve the feature and
file pages (settled below). Where the index shows follows Q2. More in
[discovery](discovery-01.md#navigating-a-round).

Why it matters: a round is the page you use most, and it runs to dozens of questions.

- **A (recommended). A bar sticks to the top of the round. It reads "7 of 12 answered", with a "Next
  unanswered" button, which scrolls to the question and focuses it, and an index button. The index
  lists every question and follow-up with its state, answered or not. It is a sheet on the phone,
  and with A in Q2, a sticky column beside the questions on wide screens. On desktop, `n` and `p`
  move to the next and previous unanswered question.**
  - [pro] the next question is one tap away, and the whole round is visible.
  - [con] a 48 px bar takes room on the phone while reading.
  - Why recommended: it is what you described, as review tools do it.
- **B. The sticky bar with "Next unanswered" only, no index.**
  - [pro] simpler.
  - [con] no way to jump to a question you have already answered.
- **C. An index at the top of the round, not sticky.**
  - [pro] nothing covers the text.
  - [con] you scroll back up to use it.

**Answer:**

## Q12: Where does a round open when you come back to it?

Back will return to where you were: that is settled below. This question is about opening the round
again from home, the navigation, or a link, after leaving it. React Router can remember a position
per page in the browser's session. Google Forms reopens a form with its draft answers. More in
[discovery](discovery-01.md#coming-back-to-a-round).

Why it matters: rounds are answered in several sittings, often from different devices.

- **A (recommended). Where you left it on this browser, and the first unanswered question
  otherwise.**
  - [pro] picks up exactly where you were on the same device.
  - [pro] on another device, it lands on what is left.
  - Why recommended: it covers both answering in order and jumping around.
- **B. Always the first unanswered question.**
  - [pro] the same on every device, nothing kept in the browser.
  - [con] loses your place when you were rereading an answered question.
- **C. The top of the round, as today.**
  - [pro] predictable.
  - [con] the problem the proposal names.

**Answer:**

## Q13: Should three problems found outside your list be fixed in this feature?

Reading the code found three problems on the pages this feature reworks:

- **A missing file loads forever.** A stale link to a file that no longer exists shows "Loading…"
  forever, the client asking again in a loop, instead of "No file"
  ([sources.ts](/packages/server/src/fate/sources.ts)).
- **The theme switch is hidden on the phone.** It shows only inside the navigation drawer.
- **Astryx 0.6.7 loses a page's state** and focus when the window crosses 768 px. 0.6.8, out on
  2026-10-10, fixes it, and Q2's two layouts make crossing it more common.

The proposal says "solely focused on functionality", and "Look and feel pass" is its own line in
Next. More in [discovery](discovery-01.md#extra-findings).

Why it matters: it sets this feature's edges.

- **A (recommended). All three join this feature: the missing file answers "No file", the theme
  switch moves into the phone's reachable menu, and Astryx goes to 0.6.8, pinned.**
  - [pro] fixed while the same pages are open, at little cost.
  - [con] a slightly larger feature.
  - Why recommended: each is small and touches the files this feature changes anyway.
- **B. Only the missing file's loop.**
  - [pro] the smallest addition.
  - [con] the state loss stays as Q2 adds layouts.
- **C. None; each becomes a line in PRIORITIES.md.**
  - [pro] the scope stays as written.
  - [con] three more items to start later.

**Answer:**

## Settled without the human

- **"Uraeda" in the top bar** links home, through the navigation heading's `headingHref`. See
  [discovery](discovery-01.md#needs-no-choice).
- **The confirmation after ＋** leaves the top bar. The new line shows where it lands when that list
  is on screen, and otherwise in a toast, with A in Q3. ＋ stays in the navigation's header. See
  [discovery](discovery-01.md#needs-no-choice).
- **Back returns to the same scroll position**: it is saved in the history entry before leaving, and
  restored once the page has drawn its data. A page keeps showing its content while its data
  reloads, instead of "Loading…". See
  [discovery](discovery-01.md#scroll-position-and-navigation-in-a-page).
- **The highlight while commenting**: the selected block keeps a tint distinct from the page's
  bands. It is scrolled above the comment field when the field opens, and the field quotes the lines
  it comments on. The comment field becomes a dialog or pane on desktop, with A in Q2. See
  [discovery](discovery-01.md#highlighting-while-commenting).
- **Written drafts and proposals open drawn as documents**, with Edit to switch to the text. An
  empty new draft opens in the text editor. See [discovery](discovery-01.md#important-reads).
- **The task view's address** uses the draft's path when the line links one, and otherwise the
  line's text. Positions change whenever a line above moves. Previous and next walk the section's
  lines. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The feature and file pages** show Astryx `Breadcrumbs` (home, feature, file) in place of today's
  "folder › file" line. See [discovery](discovery-01.md#breadcrumbs-for-questions).
- **The UI decisions** are proposed as one file per subject: components, layout, behaviour, and
  checks. They are written in the spec, for your approval, with Q1 to Q4's answers. See
  [discovery](discovery-01.md#decisions-and-how-many).
- **Mockups** of every changed view, at the phone and desktop sizes, come with the spec, as the
  workflow asks for UI work. See [discovery](discovery-01.md#likely-changes).
- **The coming-back sentence** of the proposal is read as "put me back at the top". See
  [discovery](discovery-01.md#the-sentence-cut-short).

**Notes:**
