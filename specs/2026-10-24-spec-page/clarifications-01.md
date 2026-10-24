---
status: answered
---

# Clarifications, round 01: Spec and plan pages in the terminal look

> [!NOTE]
>
> Answered on 2026-10-24.
>
> - Verdict: worth building as proposed: the page already reads every part of the spec. The work is
>   the look, the frames, the questions page's column, and a plan page.
> - Open the [prototype](mockups/spec.html) first. It draws two real specs and a real plan, and its
>   bar switches each question's options, at 1440, 1205, and 390 px.
> - A choice that lasts: how a decision's change reads, on every page that shows one.
> - A gap in the proposal: what a revision shows of the changes since your last review.
> - Settled points to check: HTML mockups drawn live in the spec, and this feature waiting for the
>   questions page to merge.

## Context

### Goal

The [proposal](proposal.md) asks for the spec, the plan, and the data model in the terminal look of
[layout and look](/specs/done/2026-10-20-layout-look.md). The whole spec draws each part its own
way, decision changes come first and most visible, and live mockups are clearly framed as embeds.
Navigation and comments come second, with the session beside the page as on the questions page.

### Today

- **The spec page** already draws each part of the format its own way, in Astryx cards of the old
  look ([`spec/`](/packages/web/src/spec/SpecPage.tsx)). A "Contents" column, with comment counts,
  shows from 1100 px only.
- **A decision's change** is computed word by word in the core, and drawn by one card shared with
  the decisions page ([`DecisionCard.tsx`](/packages/web/src/spec/DecisionCard.tsx)). Removed words
  are red with a dotted underline, never struck.
- **A live mockup** is a 1440 px page scaled into the column with no frame, or a phone with a bezel
  ([`StoryFrames.tsx`](/packages/web/src/StoryFrames.tsx)). An HTML mockup stays a link to its own
  page.
- **Comments**: a tap selects a block, then a form. The comments and the verdict sit at the page's
  end. "Ask the agent" leaves for the session's page, and is not offered on a decision's lines.
- **A plan** waiting for review is plain blocks with a badge per task; an approved plan loses even
  the badges ([`FilePage.tsx`](/packages/web/src/FilePage.tsx)).
- **A revision** answers each comment in "Your review, answered". Nothing marks what changed in the
  spec itself.

The questions page's approved spec, on its branch, builds a right column of tabs at one width:
Outline, Notes, and Session. It is "for the spec page to reuse". The
[layout decision](/specs/decisions/ui-layout.md) there allows a feature's session beside any of its
documents.

### Scope

The spec page, the plan page, and the data model, at the three widths, waiting for review or read
after approval. The decision's own page and the decisions page follow the decisions' new look, since
they share its card. What a spec holds, how comments are written, and how a verdict commits stay as
they are. Keyboard navigation and a git view of changes are their own items in the priorities.

### Sources

- The pages' code, linked above, and screenshots of today's page at 1440 and 402 px.
- Kiro's Markdown Review and specs, GitHub's pull request reviews and rich diffs, and Spec Kit.
- Google Docs, Notion, Linear, Confluence, GitBook, Gerrit, Reviewable, and Phabricator.
- Cursor's, Claude Code's, and Windsurf's plans.
- Wikipedia's and Word's diffs, jsdiff, MDN and WCAG on `<ins>`, `<del>`, and colour; Storybook
  10.6's embeds, Polypane, Figma, and tmux on framing a live viewport.
- The [prototype](mockups/spec.html), described in [its README](mockups/README.md).
- The full investigation is in [discovery](discovery-01.md). Each question links its topic.

## Q1: How should a decision's change read?

Example: the layout-look spec changes the UI layout decision. One rule goes from "mockups at both
width classes" to "at each width class". Another goes from two classes to three, and five rules
stay.

Today's card shows each section with a pill per changed part, and removed words red without a
strike. Wikipedia and Word mark changes by a sign or a strike as well as colour, as WCAG asks.
GitBook and Wikipedia also offer before and after side by side. The card is shared: the decisions
page and a decision's own page change with it. More in
[discovery](discovery-01.md#the-decisions-look).

Why it matters: decisions bind every later feature, so you read this part most carefully. Every page
with a decision's change takes the same look.

- **A (recommended). A ledger: each decision a strong pane, green when new and mauve when changed.
  Its rules are lines with a sign, + added, ~ changed, − removed. Changed words are underlined or
  struck inside. Unchanged rules and the Why fold, with their count.**

  [Ledger](mockups/spec.html?doc=layout-look&dec=ledger)

  - [pro] the changed rules come first, readable in one column at every width.
  - [con] an unchanged rule is one click away.
  - Why recommended: it shows what changes before anything else, and reads the same on a phone.

- **B. Before and after side by side for each changed rule, in two boxes; stacked on the phone. The
  rest as in A.**

  [Before and after](mockups/spec.html?doc=layout-look&dec=split)

  - [pro] each version reads whole, without marks to decode.
  - [con] twice the height, and the phone stacks them.

- **C. Today's card in the new look: every section under its heading, a pill per changed part,
  unchanged parts folded per section.**

  [Today's card](mockups/spec.html?doc=layout-look&dec=cards)

  - [pro] the least work, and nothing new to learn.
  - [con] pills, not signs, and removed words are not struck: colour stays the main cue.

**Answer:** A

## Q2: How should a live mockup show that it is an embed?

Example: the layout-look spec's "A shell for three widths" shows three live mockups, at 1440, 1205,
and 390 px. At 1440 px, the desktop one is drawn at about 42% in the spec's column.

The proposal suggests a monitor or phone bezel, "not a requirement". The look decision asks for
square corners and titled borders. Polypane and tmux mark a live viewport by a titled border with
its size; bezel stylesheets are photoreal and unmaintained since 2023. Every option keeps a
full-screen button, at 100%. More in [discovery](discovery-01.md#framing-live-mockups).

Why it matters: it is how every mockup of every spec reads from now on.

- **A (recommended). A live window: a double border in another colour, its title "live", the
  mockup's name, its size, and its scale, on a hatched background.**

  [Live window](mockups/spec.html?doc=layout-look&embed=window)

  - [pro] the terminal look's own frame, and the scale says when text is too small to judge.
  - [con] no device shape: phone and desktop differ by their icon and width only.
  - Why recommended: it says "embed" in the look's own words, and loses the least width.

- **B. Device bezels: a monitor with its stand for desktop widths, a phone with a notch for the
  phone.**

  [Device bezels](mockups/spec.html?doc=layout-look&embed=device)

  - [pro] the most obvious "this is a screen", as the proposal suggests.
  - [con] round drawn devices in a square look, and the stand and bezel take room.

- **C. A browser window: three dots and an address bar holding the mockup's path.**

  [Browser window](mockups/spec.html?doc=layout-look&embed=browser)

  - [pro] familiar, and the address names what is shown.
  - [con] a browser's chrome inside a terminal tool reads as out of place.

**Answer:** A

## Q3: What should the right column hold beside the session?

Example: you review the layout-look spec at 1440 px. You commented on two rules and a scenario, and
want to check them before approving, without scrolling to the page's end.

The questions page's column has three tabs at one width: Outline, Notes, and Session. On the spec,
Contents takes Outline's place, and the session is a tab as there. Comments and the verdict sit at
the page's end today, and Contents counts comments per part. Kiro and Google Docs list comments in a
side panel. More in [discovery](discovery-01.md#the-right-column).

Why it matters: it decides where you see your review while you read, and the plan page takes the
same column.

- **A (recommended). Three tabs: Contents, Review, and Session. Review lists your comments, each
  jumping to its place, and holds the verdict's two buttons. The verdict's full form stays at the
  page's end too.**

  [Review tab](mockups/spec.html?doc=layout-look&tab=review)

  - [pro] your comments and the verdict are always one click away.
  - [con] a third tab; the verdict shows in two places, drawn by one component.
  - Why recommended: "navigation second, with comments", as the proposal asks.

- **B. Two tabs: Contents, with each part's comment count, and Session. The comments and the verdict
  stay at the page's end only.**

  [Contents](mockups/spec.html?doc=layout-look&tab=contents)

  - [pro] the fewest tabs, and one place for the verdict.
  - [con] checking your comments means scrolling to the end.

- **C. As B, with the verdict's buttons always in the status line at the window's bottom.**
  - [pro] the verdict is always in view.
  - [con] the status line holds keys and counts today, and "Approve" sits under every part you have
    not read yet.

**Answer:** A

## Q4: What should a revision show of the changes since your last review?

Example: you requested changes on the layout-look spec with three comments. Revision 2 changes the
UI layout decision, a scenario, an edge case, and a success criterion.

Today, revision 2 answers each comment in "Your review, answered", and its time counts only what
changed, but the page marks nothing. Gerrit, Reviewable, and GitBook show what changed between the
reviewed version and the new one. The review file already records the commit you reviewed; the core
compares decisions word by word, and could compare the spec's parts the same way. The proposal does
not mention revisions. More in [discovery](discovery-01.md#changes-since-the-last-review).

Why it matters: it decides whether a re-review takes the time the block announces, or a full
re-read.

- **A (recommended). A "Since your review" pane at the top lists the changed parts. Each is marked Δ
  in the page and in Contents, with its words diffed as a decision's change is.**

  [Revision 2](mockups/spec.html?doc=layout-look&since=1&w=1205)

  - [pro] you read only what changed, and see what it was before.
  - [con] the core compares the spec too, a new part of this feature.
  - Why recommended: the workflow already counts only the changes in a revision's time.

- **B. The same list and Δ marks, without the words: you read the new text only.**
  - [pro] the page reads clean.
  - [con] you see where it changed, not what it was.

- **C. Nothing new: "Your review, answered" only.**
  - [pro] no new work.
  - [con] a revision means reading the whole spec again to find the changes.

**Answer:** A

## Q5: What should the plan page put first?

Example: the questions page's plan is auto-approved and half built: tasks 1 to 3 done, task 4 next,
15 of 47 steps checked.

A plan waits for your review only when you ask for it. By default it runs without one, and you open
it to see where the build is. Kiro and Cursor show a plan as tasks with their status. Today an
approved plan draws as plain text, without its tasks' badges. More in
[discovery](discovery-01.md#the-plan-page).

Why it matters: it is what you see each time you check on a build.

- **A (recommended). Progress first: a bar, the waves with each task's state, the current task open,
  other tasks folded with their count of steps. The sections for the implementer fold at the end. A
  plan waiting for review opens its review focus and every task instead.**

  [Progress first](mockups/spec.html?doc=plan&plan=progress)

  - [pro] where the build is, at a glance, and the current task's steps.
  - [con] the core reads the plan's waves, new work.
  - Why recommended: a plan is mostly read during its build.

- **B. The file's order: each section a pane, every task open with its steps and badge.**

  [File order](mockups/spec.html?doc=plan&plan=document)

  - [pro] reads as written, the least work.
  - [con] the current task sits below about 400 lines of plan.

**Answer:** B: The plan is either read before tasks start or never

So let’s do what’s the least work

## Settled without the human

### Check these

- **HTML mockups drawn live**: a spec's link to an HTML mockup, alone in its paragraph, draws in a
  frame like a story. Today it is a link to its own page. The questions page's spec had to be opened
  mockup by mockup. Its page stays, for full screen. See
  [discovery](discovery-01.md#important-reads).
- **Built after the questions page merges**: this feature reuses that branch's column, tabs, session
  in a box, and quoting. Its spec can be written now; its plan starts once that branch merges, on
  top of it. See [discovery](discovery-01.md#the-questions-pages-column).
- **Asking about a decision**: "Ask the agent" is offered on every selection, a decision's lines
  included, which today it is not. The quote names the decision's file and lines. See
  [discovery](discovery-01.md#important-reads).
- **The decisions' look everywhere**: one card draws every decision's change, as the
  [UI coherence](/specs/decisions/ui-coherence.md) decision asks. The decision's own page on a
  branch, the decisions page's branch change, and the decisions check take the new look too. See
  [discovery](discovery-01.md#rules-and-their-owners).

### Behaviour

- **The page's look**: the block is a titled pane, "Spec to review, about N minutes", led by "You
  approve". Every part is a titled pane with its icon, as on the questions page. Decisions come
  right after the block in heavier panes. See
  [discovery](discovery-01.md#decisions-first-and-most-visible).
- **The column** is the questions page's: one width, a third of the window, Contents first, folded
  with `]`. It replaces today's Contents column, which hid below 1100 px. See
  [discovery](discovery-01.md#the-questions-pages-column).
- **Contents** lists every part, marks the one at the top, and counts comments per part, as today.
  See [discovery](discovery-01.md#needs-no-choice).
- **On the phone**: Contents and your comments open as sheets from the status line, beside a
  "Verdict" button. The session stays its own page, as on the questions page. See
  [discovery](discovery-01.md#the-questions-pages-column).
- **The plan's session**: the plan page has the Session tab too, quoting the selected lines. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The data model** stays inside the spec as "Data", after the stories; opened alone, it draws the
  same panes. See [discovery](discovery-01.md#important-reads).
- **An approved plan** draws the same page as a waiting one, without the verdict. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **A frame's scale**: a mockup stays at its real width, scaled to fit. Full screen shows it at
  100%, and a phone mockup shows at full size wherever it fits. See
  [discovery](discovery-01.md#storybook-embeds-and-scaled-frames).
- **Keys** stay today's, plus `]`: keyboard navigation is its own item in the priorities. See
  [discovery](discovery-01.md#needs-no-choice).

### Under the hood

- **The data model's sections** are read by the core, as the [stack](/specs/decisions/stack.md)
  decision asks; the web stops parsing them. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **Changes are drawn** with `<ins>` and `<del>`, signs, a wavy underline, and a strike, so colour
  is never the only cue. The core's word diff stays: no diff library. See
  [discovery](discovery-01.md#diffs-libraries-and-accessibility).
- **Files near the limit**, `DecisionCard.tsx`, `BuiltParts.tsx`, `StoryEmbed.tsx`, and
  `StoryFrames.tsx`, split before they grow. See [discovery](discovery-01.md#important-reads).
- **The sandbox** builds the spec page's fixtures, so the redraw is reviewed with a data model and a
  rich decision change. See [discovery](discovery-01.md#important-reads).
- **The prototype** is deleted when the spec is approved, as the
  [preview decision](/specs/decisions/preview.md) says.

**Notes:**

- **Built after the questions page merges**: We can start rebasing now, it’s already almost done but
  the last bugfixing steps always take some time
