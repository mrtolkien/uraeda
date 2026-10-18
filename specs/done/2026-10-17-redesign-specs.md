---
kind: feature
finished: 2026-10-18
pull-request: https://github.com/mrtolkien/uraeda/pull/33
---

# Record: Redesign and reword specs

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-17, finished on
> 2026-10-18, in [its pull request](https://github.com/mrtolkien/uraeda/pull/33). Its full files are
> in git: `git log -- specs/2026-10-17-redesign-specs/`.

## What and why

Approving a spec is the human's most important job, and specs had become a sea of bullet points:
3,900 to 7,700 words, decisions buried after the stories, review comments answered by number, and
decision links that opened the wrong branch. The human asked for a page approved in one sitting,
without any other context: what is approved first, then the decisions with their changes marked in
place, then the stories as cards, each part drawn for what it holds. Decisions had grown to 18,728
words, and the human wanted them short, intent first, with every line approved by a human.

## Behaviour

- **The spec's format.** `spec.md` holds, in order: the block, whose first item starts "You
  approve", at most 7 items; `## Your review`, from revision 2, one item per comment of the last
  review, `- **C2** (summary): done. ...`; `## Decisions`, items
  `- **New: [Title](../decisions/x.md)**.`, `Changed:`, or
  `- **Removed: Title** (\`x.md\`).`, then a "Relied on" table; `## User
  stories`, each with a journey, its mockup link, "Key scenarios:" and optional "More scenarios:"; `##
  Architecture`, bold-led units then "Tradeoffs:"; `## Edge
  cases`, a table whose first column is high, normal, or niche; `## Success criteria`, `- **SC-001**
  (measure): outcome.`; `## Assumptions`; a one-row `## Constitution check`; `## Risk
  tier`; and an optional `## History`of earlier review records.`## Mockups`and`##
  Details`are gone, with no fallback. Data goes to`data-model.md`, written by the spec step whenever stored data or a file format changes; build details go to the plan's `##
  Test map`.
- **Decisions.** A decision is created or changed only from an answered question or a review
  comment. It is edited in place on its branch and marked `proposed`; `## Proposed change` sections
  are gone. Its intent comes first, then at most 10 rules, one sentence each with its check,
  strongest first: MUST and MUST NOT, then SHOULD and SHOULD NOT, then MAY. The approval step sets
  `active` and `approved-by` on each decision a `## Decisions` item names; "Relied on" links never
  count.
- **`ura check`** reports `sections.order` and `sections.unknown` from the templates, and the error
  `edges.importance`. It warns `spec.length` past 2,500 reviewed words, `block.items` past 7 items,
  `decision.rules` past 10 rules, `decision.order` on a rule stronger than the one before it, and
  `decision.unapproved` when a decision's text, `status` and `approved-by` aside, changed after the
  approval of the spec's current revision. The reviewed part leaves out the block, code, links'
  text, the "More scenarios" lists, and `## History`. Only the CLI runs the history check: workspace
  reads skip it.
- **A decision's change** is never written down. The core compares the decision on the branch with
  its version at the merge base with the default branch. Both are cut into paragraphs and list
  items, lines joined, so a rewrap is no change. Two parts in the same section are one part when
  they keep at least 60% of the shorter's words, and compare word by word; an equal part moved
  within its section is kept. A branch without a merge base shows its decisions uncompared.
- **The spec page.** Every spec opens on one page, read-only once approved. "What you approve" holds
  the time and risk tier as pills, the "You approve" sentence large, and the principles as a strip
  with a check or a warning icon. "Your review, answered" quotes the review the revision answers,
  read as it stood when the revision was committed. Each decision is a card: its kind's pill, "Not
  listed in the spec" when the spec does not list it, its intent, kept parts folded behind "N
  unchanged", removed parts behind "N removed" on a red tint with a dashed edge, added words green
  and underlined, removed words red with a dotted underline, never struck, and each rule with its
  strength's chevron icon, coloured by strength, at most 75 characters a line. Each story is a card
  with its live mockup, its key scenarios as Given, When, and Then rows, and the others behind "N
  more scenarios". Then "Data", from `data-model.md`, with its change pills, and "How it is built,
  and its limits": units as small cards, tradeoffs with a "Cost" pill, edge cases by importance with
  the niche ones folded, criteria with their id and measure as pills. Earlier records sit in
  "History", folded.
- **Moving through it.** On a wide screen, "Contents" lists every part, decision, and story with its
  pending comments, and holds Approve and Request changes; it folds with `]`, resizes, and remembers
  both. On the phone, parts lose their cards, text runs to 12 px from the edges, and each part's
  title sticks under the top bar with its breadcrumbs. A link into the spec lands on its part, and
  opens a folded scenario.
- **Comments.** A tap on any part, a decision's included, opens the comment form. A comment on a
  decision is written `## C4: Decision task-storage, lines 20–21, under "Rules"`, with `removed`
  after the lines for a part only the default branch has, whose lines are the merge base's. A
  decision link from a feature's files opens the decision as that branch has it, at its anchor.
- **Small fixes.** Commenting keeps the text you read in place, at both widths, and story frames
  above you resize without moving it. The edit box of a proposal or a draft shows its text without
  the frontmatter, joined back unchanged on save.

## Design

The core owns the format. [`files/spec.rs`](/crates/core/src/files/spec.rs) and
[`files/spec/parts.rs`](/crates/core/src/files/spec/parts.rs) send `SpecItems`, with each story's
key and more blocks and each criterion's sentence; the step that finds pending decisions reads its
`decisions`. [`decisions/change.rs`](/crates/core/src/decisions/change.rs) compares two texts and
[`decisions/strength.rs`](/crates/core/src/decisions/strength.rs) reads a rule's strength, for the
page and the checks alike. [`decisions/branch.rs`](/crates/core/src/decisions/branch.rs) reads a
branch's decisions on both sides through [`git.rs`](/crates/core/src/git.rs), whose `merge_base` and
`approval_commit` are the only git reads. The file view carries `decisionChanges` and `answered`
([`api/answered.rs`](/crates/core/src/api/answered.rs)), and
[`api/decision.rs`](/crates/core/src/api/decision.rs) serves a branch's decision. The checks live in
[`check/spec.rs`](/crates/core/src/check/spec.rs),
[`check/decision.rs`](/crates/core/src/check/decision.rs), and
[`check/unapproved.rs`](/crates/core/src/check/unapproved.rs); review anchors in
[`files/review.rs`](/crates/core/src/files/review.rs) and
[`actions/review/decision.rs`](/crates/core/src/actions/review/decision.rs).

The web draws the core's parts: [`spec/SpecPage.tsx`](/packages/web/src/spec/SpecPage.tsx) wires
[`Panel`](/packages/web/src/spec/Panel.tsx),
[`SpecOpening`](/packages/web/src/spec/SpecOpening.tsx),
[`ReviewAnswers`](/packages/web/src/spec/ReviewAnswers.tsx),
[`DecisionCards`](/packages/web/src/spec/DecisionCards.tsx) and
[`DecisionCard`](/packages/web/src/spec/DecisionCard.tsx),
[`StoryCard`](/packages/web/src/spec/StoryCard.tsx),
[`BuiltParts`](/packages/web/src/spec/BuiltParts.tsx),
[`DataPart`](/packages/web/src/spec/DataPart.tsx), and
[`SpecContents`](/packages/web/src/spec/SpecContents.tsx). The plan's review page shares the comment
machinery of [`review/`](/packages/web/src/review/). The reading place is kept by
[`keepPlace.ts`](/packages/web/src/keepPlace.ts); the editor's frontmatter by
[`pane/draftText.ts`](/packages/web/src/pane/draftText.ts). The skill describes the format in
[`references/spec.md`](/skills/uraeda/references/spec.md), its limits in
[`references/writing.md`](/skills/uraeda/references/writing.md), and the approval in
[`references/approval.md`](/skills/uraeda/references/approval.md), with its templates and the
example, a revision 2 with its `data-model.md`.

## Questions

### Round 01

#### Q1: What does this feature cover?

**Answer:** A: specs and decisions, with both bugs, and the data model written at the spec step, "a
good way to visualize the changes and new data in the system".

#### Q2: How does a spec write a change to a decision?

**Answer:** A: edit the file in place, `status: proposed`, "deterministic: the decision changes view
and diff at the top can be based on the actual decision changes proposed in files".

#### Q3: How does a decision's change show on the spec page?

**Answer:** A and C: changes marked inline, old wording folded, since C is "the only where we can
cleanly see deletions".

#### Q4: When may an agent create or change a decision?

**Answer:** A: only from an answered question: "Every single line in decisions must have been
approved by a human, so it's ok to add a bit more friction".

#### Q5: What shape does a decision take?

**Answer:** A: intent first, with warnings; rules "naturally fewer if we focus on big picture and
intent instead of specifics".

#### Q6: When are the 18 existing decisions rewritten?

**Answer:** B: in this feature: "I'll actually judge the success of this branch based on the quality
of the rewritten decisions".

#### Q7: In what order does the spec page show its parts?

**Answer:** A: the block, the review answers, the decisions, the stories with their mockups; "Edge
cases and more needs to be restructured for readability".

#### Q8: How does the spec page look?

**Answer:** A: cards on desktop, but "unusable on mobile, way too much wasted space" there.

#### Q9: Does a spec have a length budget?

**Answer:** A: a target, a warning, key scenarios, and a split; context stays in the clarifications
"to take the right decisions".

#### Q10: What moves from the spec to the plan?

**Answer:** A: the details move to the plan; the architecture stays.

#### Q11: What goes in the right column on a wide screen?

**Answer:** A: an index with comment counts and the verdict.

#### Q12: How are data models written?

**Answer:** A: tables always, a diagram for relationships and states.

#### Notes

- The constitution check is a small table of check marks.
- "Relied on" is a small table, each decision with its impact on the spec.

### Round 02

#### Q1: How does the toolchain decision take `main`'s change?

**Answer:** A: the rewrite stands, with `main`'s optional coverage and four CI rules merged into its
own rules, staying at 10.

## Decisions

- Changed, rewritten intent first: [agents](../decisions/agents.md),
  [attachments](../decisions/attachments.md), [CLI](../decisions/cli.md),
  [code quality](../decisions/code-quality.md), [distribution](../decisions/distribution.md),
  [git](../decisions/git.md), [notifications](../decisions/notifications.md),
  [preview](../decisions/preview.md), [repositories](../decisions/repositories.md),
  [settings](../decisions/settings.md), [sign-in](../decisions/sign-in.md),
  [stack](../decisions/stack.md), [toolchain](../decisions/toolchain.md),
  [TUI](../decisions/tui.md), [UI behaviour](../decisions/ui-behaviour.md),
  [UI checks](../decisions/ui-checks.md), [UI components](../decisions/ui-components.md), and
  [UI layout](../decisions/ui-layout.md): 18,728 words became about 9,400.
- The stack decision folds in access-storybook's rule that Storybook's channel is forwarded only as
  a preview's.

## Changes after approval

- Revision 3 folds `main`'s later change to the toolchain decision into its rewrite, as answered in
  round 02; one consequence was reworded after that approval to keep the decisions within 9,400
  words, and `ura check` warns about it until a human approves the wording.
- WebKit's scroll anchoring did not hold, so the page keeps the reading place itself, as the spec
  allowed.
- `decision.unapproved` counts from the approval of the spec's current revision, so a newly approved
  revision resets it. A decision the branch had not touched at approval, now equal to the default
  branch's text, does not warn.
- "Your review, answered" quotes the review the revision answered, read in git, also after approval;
  the spec's review focus first said an approved revision shows no quotes.
- An unlisted decision shows only when a part changed, or it is new, removed, or uncompared: a
  rewrap or a frontmatter edit shows no card.
- A removed part has a dashed red edge, and the selection's edge is darker in light mode, both for
  3:1 contrast; the selection change reaches every review page.
- A link alone in its paragraph is drawn at a control's height, 44 px under a coarse pointer, on
  every page.
- A comment's quote on a decision uses a single `>`.

## Follow-ups

- The minor findings of the reviews are in the inbox under **Deferred fixes**, about
  `redesign-specs`: skill wording, spec parsing, the spec page, the comparison, decision comments,
  the checks, the answered review after a merge, the reading place and the editor, and the
  toolchain's test runs.
- The compatibility and diagrams decisions warn `decision.order`: their approved text puts a weaker
  rule first.
- No anchor exists inside a story's folded scenarios: linking a scenario needs an anchor scheme.
