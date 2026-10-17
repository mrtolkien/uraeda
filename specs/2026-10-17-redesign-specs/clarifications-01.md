---
status: answered
---

# Clarifications, round 01: Redesign and reword specs

> [!NOTE]
>
> Answered on 2026-10-17.
>
> - Verdict: worth building, with changes. Specs and decisions now; plans and data models only where
>   they meet the spec.
> - Decisions change the most: how a change is written, how it shows, who creates one, and its
>   shape. Four questions work together on them, and they last beyond this feature.
> - The proposal's word budget pulls against your "I want MORE context" in the clarifications
>   redesign. One question weighs them.
> - Two questions come with live mockups to try: the page's look, and how a decision's change shows.
> - This feature builds on the clarifications redesign: its writing reference, warnings, diagrams,
>   and table floors. Its plan starts once that branch merges.
> - Every spec, plan, and decision template changes. Under the compatibility decision, branches in
>   flight rewrite their spec when they next move.

## Context

**Goal.** A spec you approve in one sitting, without opening anything else. What you approve comes
first, then the decisions, each change shown as a diff you can comment on. Then one linear document,
with cards, tables, colour, and hierarchy. "Readable" also means any model writes it the same way.

**Today.** Specs run 3,900 to 7,700 words, and take about 15 minutes to approve against blocks
claiming 20 to 45. All 37 review comments so far landed on the block, the mockups, or the spec as a
whole: none on architecture, details, or a decision file. Every spec created or changed about two
decisions, and a one-rule change restates every rule. Decision links open the default branch, where
a proposed decision does not exist yet. The page draws a spec as plain markdown, with folds.

**Scope.** This round covers the spec's wording and page, decisions, and where plans and data models
meet them. It also covers two bugs from the proposal: the frontmatter in the edit box, and the page
jumping when you comment.

**Sources.**

- 24 specs and their reviews, 18 decisions and their history, 24 plans, from every branch.
- The core's spec parser and checks, the review page, the decisions page, and the editor.
- Spec Kit, Kiro, BMAD, Superpowers, Copilot Workspace; Google, Rust, KEP, and Squarespace design
  documents; Nygard, MADR, and ADR tools.
- Google Docs, Word, Notion, GitBook, Confluence, and GitHub on showing a change.
- NN/g, GOV.UK, and WCAG on reading; Anthropic, OpenAI, and Google on writing instructions.
- The clarifications redesign's approved spec, on its branch.
- The links are in [discovery](discovery-01.md#how-other-products-do-it).

## Q1: What does this feature cover?

The proposal holds several parts:

| Part                                     | Today                                                   |
| ---------------------------------------- | ------------------------------------------------------- |
| The spec's wording and page              | read by you on every feature                            |
| Decisions: format, diff, comments, links | read only through the spec's block                      |
| Plans                                    | never reviewed: `plan-review` was false in all 21 specs |
| Data models                              | no `data-model.md` ever written                         |
| Edit box frontmatter, page jump          | two bugs, a few files each                              |

Kiro and Spec Kit keep the "what" you approve apart from the "how" the agent builds from. More in
[discovery](discovery-01.md#the-scope-holds-several-features).

Why it matters: it sets the feature's size, and whether decisions wait for a feature of their own.

- **A (recommended). This feature redesigns the spec and decisions together: their wording, format,
  page, and diff. Plans lose what they copy from the spec, data shapes become tables, and both bugs
  are fixed here.**
  - [pro] decisions come first on the spec page, so the two are designed once.
  - [con] a large feature, across the skill, the core, and the web.
  - Why recommended: you asked for decisions first in the spec, and plans are never read.
- **B. This feature redesigns the spec alone. Decisions, with their format and diff, become the next
  feature.**
  - [pro] a smaller first feature.
  - [con] the spec page is laid out twice, and decision links stay broken until then.
- **C. This feature redesigns every agent page: specs, decisions, plans, data models, rulings, and
  records.**
  - [pro] one pass over every page.
  - [con] the largest feature, mostly on pages you never review.

**Answer:** A: Also add data model at the spec step: it’s a good way to visualize the changes and
new data in the system

## Q2: How does a spec write a change to a decision?

Today a spec adds a `## Proposed change` section at the end of the decision. It restates every rule
"as it would read after the change", so you compare two copies by eye. add-bugfixing called its
change "wording only", and asked you to read 1,095 words for about 30 changed lines. Once approved,
the approval step rewrites the decision, and the change survives only in git. More in
[discovery](discovery-01.md#how-a-spec-changes-a-decision).

Why it matters: it is how every later feature changes a decision, and it decides what a diff
compares.

- **A (recommended). The spec step edits the decision file in place, on the feature's branch, and
  marks it `status: proposed`. Approving the spec sets it back to `active`. The diff is the file
  against the default branch.**
  - [pro] the diff is exact, with `git diff` or any tool, and nothing is restated.
  - [con] the rule "an active decision is never edited before approval" becomes "edited only on its
    branch, until approval".
  - Why recommended: other branches read the default branch's decisions, so nothing binds early.
- **B. The `## Proposed change` section stays, listing only the rules that change, each as "Rule 3
  becomes" or "New rule". The page compares each with the rule it replaces.**
  - [pro] the active text stays untouched on every branch.
  - [con] a format for changes, which tools must parse and agents must follow.
- **C. The section stays as today, restating every rule. The page compares it with the active
  rules.**
  - [pro] no change for agents.
  - [con] the longest to write, and a reworded rule looks removed and added.

**Answer:** A: This has the added bonus of being deterministic: the decision changes view and diff
at the top can be based on the actual decision changes proposed in files, there’s no complex parsing
to do

## Q3: How does a decision's change show on the spec page?

Every prose tool shows a change inside the rendered text: Google Docs, Word, and Confluence mark
insertions and strike deletions. GitBook shows before and after side by side by default. The mockups
compare by paragraph and list item, so a rewrapped line is no change. Unchanged rules fold behind a
count. Each mockup shows task storage gaining one rule and one reworded rule. More in
[discovery](discovery-01.md#how-a-decisions-change-shows).

Why it matters: it is where you check the one thing that stays after a branch.

Under every option, you comment on any changed part, and a new decision shows in full.

- **A (recommended). The new text, with added words underlined in green and removed words struck in
  red, in place.**

  [Inline](/packages/web/src/mockups/DecisionChange.stories.tsx#Inline)

  - [pro] the change reads as one sentence, the same on a phone.
  - [con] a heavily rewritten rule is hard to read.
  - Why recommended: it is what every prose tool does, and it fits a phone.

- **B. Each changed part as two columns, before and after, stacked on a phone.**

  [Side by side](/packages/web/src/mockups/DecisionChange.stories.tsx#SideBySide)

  - [pro] both versions read cleanly.
  - [con] you find the changed words yourself, and it takes twice the room.

- **C. The new text, each changed part marked "Changed" or "New", its old wording behind a toggle.**

  [Marked](/packages/web/src/mockups/DecisionChange.stories.tsx#Marked)

  - [pro] the cleanest read of the result.
  - [con] the change itself takes a tap to see.

**Answer:** A and C: I picked C because it’s the only where we can cleanly see deletions

With A a deletion would be struck out, with B it’d be weird, but with C we can have a “Deleted X
lines” toggle to see removed lines. Make a mockup in the spec.

If you think A could properly show removed lines too, I’m also ok with it

## Q4: When may an agent create or change a decision?

The skill says "Most features produce no decision, or one". In practice every spec produced one,
about two on average. Decisions are asked about when a round's question "would become a decision",
but the spec step also adds its own. About 12 rule changes went in through fix, feat, and chore
commits, with no spec. More in [discovery](discovery-01.md#what-not-human-checked-enough-means).

Why it matters: a decision binds every later feature, and you called decisions "the main thing that
stays from a branch".

C can come on top of A or B.

- **A (recommended). A decision is created or changed only from a question you answered, or a review
  comment that asks for it. The spec step writes it down, and never adds one of its own.**
  - [pro] every decision traces to your words.
  - [con] a decision the spec step finds late needs a new round of questions.
  - Why recommended: A, with C on top. Your answer creates it, and the warning catches the rest.
- **B. The spec step may propose a decision of its own, as today, and your approval of the spec
  covers it.**
  - [pro] no extra round.
  - [con] decisions you never weighed, approved with a whole spec.
- **C. `ura check` warns when a branch changes a decision its spec does not list.**
  - [pro] changes in fix or chore commits show up.
  - [con] a warning only: a hurried agent can ignore it.

**Answer:** A: Every single line in decisions must have been approved by a human, so it’s ok to add
a bit more friction

We should also make decisions lighter and shorter, they already grew out of control. I feel like
decisions should focus more on intent and less on specifics, except when specifics are real hard
constraints.

## Q5: What shape does a decision take?

Uraeda's 18 decisions average 1,040 words and 11 rules, against 276 words and 3 rules in the skill's
example. Every decision a spec changed grew 2 to 4 times. Nygard keeps a record to "one or two
pages". MADR's minimal one is the problem, the options, "Chosen option: X, because", and the
consequences. In session-view's review you asked for "more concepts-based and less hard rules". More
in [discovery](discovery-01.md#the-shape-of-a-decision).

Why it matters: decisions are read by every agent on every feature, and by you on every change.

- **A (recommended). A decision opens with its intent, in two or three sentences. It holds at most 7
  rules, each one sentence ending with how it is checked. Past 7, the topic splits. History and
  investigation go in the feature's record. `ura check` warns past the limits.**
  - [pro] concepts first, short enough to diff and to read.
  - [con] long decisions like agents (14 rules) must split.
  - Why recommended: it is the example's size, and the limits are checked, not hoped for.
- **B. Decisions keep today's shape, with the shared sentence limit of 25 words and a summary of at
  most 3 sentences.**
  - [pro] no split, and shorter sentences.
  - [con] the rule count still grows with every change.
- **C. Decisions keep today's shape and length.**
  - [pro] no change.
  - [con] decisions keep growing.

**Answer:** A: I’m not sure we need a hard limit to rules, I think generally rules should be
naturally fewer if we focus on big picture and intent instead of specifics

Maybe put 10 as a soft maximum, we issue a warning when there are more rules

## Q6: When are the 18 existing decisions rewritten?

Only matters with A or B in Q5. A shorter shape does not change the decision template's headings, so
the compatibility decision does not force a rewrite: old decisions stay valid. Rewriting all 18
means reviewing 18,728 words of changes.

Why it matters: it decides when the decisions you read today get shorter, and how much you review at
once.

- **A (recommended). A follow-up feature rewrites them, a few per review, each shown with the new
  diff.**
  - [pro] each rewrite is reviewed as a change, with the tools this feature builds.
  - [con] the long decisions stay until then.
  - Why recommended: the diff view makes the rewrite reviewable, once it exists.
- **B. This feature rewrites all 18, in its spec.**
  - [pro] every decision is short when this feature merges.
  - [con] the spec doubles in what you review.
- **C. Each decision is rewritten only when a feature next changes it.**
  - [pro] no dedicated work.
  - [con] untouched decisions stay long for good.

**Answer:** B: I’ll actually judge the success of this branch based on the quality of the rewritten
decisions you suggest

## Q7: In what order does the spec page show its parts?

You asked for decisions first, then a linear document. In an earlier review you wrote "Mockups
should be front and center in the spec view". The proposal also asks for a mockup gallery second,
and for the big mockup buttons to go "now that they are embedded". Reviewers comment most on what
comes first. More in [discovery](discovery-01.md#decisions-first-against-mockups-front-and-center).

Why it matters: what comes first gets reviewed most.

- **A (recommended). What you approve, then the answers to your last review on a revision, then the
  decisions, then each story with its mockup and key scenarios. Edge cases, success criteria,
  architecture, and the rest come last. The mockup buttons go.**
  - [pro] decisions first, and each mockup beside the story it shows.
  - [con] the first mockup sits below the decisions.
  - Why recommended: it is your order, and a gallery would show each mockup twice.
- **B. The same order, with a "What you'll see" gallery of every mockup right after the decisions.
  Stories show no mockup.**
  - [pro] every screen in one place.
  - [con] a story's mockup is away from its scenarios.
- **C. The mockup gallery first, then the decisions, then the stories.**
  - [pro] the easiest thing to check comes first.
  - [con] decisions are no longer first.

**Answer:** A: Edge cases and more needs to be restructured for readability

## Q8: How does the spec page look?

Both mockups draw the same spec, the skill's recurring tasks rewritten, at its second revision. The
order is A of Q7. A story's mockup shows as a box: it is live in the real page. Astryx has tinted
cards and badges. NN/g finds cards less scannable than lists, and right for chunks of different
kinds, like a decision beside a story. More in [discovery](discovery-01.md#the-pages-look).

Why it matters: it is how every spec reads. The look and feel pass comes later, for icons and
polish.

- **A (recommended). Each part in its own card: a tinted card for what you approve and for your
  review's answers, a card per decision and per story. Scenarios read as Given, When, and Then rows,
  two or three shown, the others behind "N more scenarios".**

  [Cards](/packages/web/src/SpecPage.stories.tsx#Cards)

  - [pro] each story and decision reads as one unit, as you asked.
  - [con] more scrolling, and cards nest inside parts.
  - Why recommended: it gives the cards, colour, and hierarchy the proposal asks for.

- **B. One document: each part opens with a small label and a coloured rule down its side. Each
  story sits under a band, its scenarios as today's numbered list.**

  [Document](/packages/web/src/SpecPage.stories.tsx#Document)

  - [pro] the most compact, and close to the file as written.
  - [con] stories run into each other.

**Answer:** A: I like A on desktop, but it’s unusable on mobile, way too much wasted space

Make sure mobile uses as much of the width of possible while keeping clear hierarchy

Similar to clarifications we can have a sticky header of the current paragraph we are viewing, with
breadcrumbs

## Q9: Does a spec have a length budget?

The proposal asks for 1,500 to 2,000 words in the part you review: the example's size. In the
clarifications redesign you answered "I want MORE context if anything, do not limit it". On records
you wrote "What matters is a clear structure". Folding did not shorten specs: 5,054 words before,
5,474 after. Models follow word counts poorly, under 30% with plain instructions; a tool's check
works. More in [discovery](discovery-01.md#the-word-budget-against-more-context).

Why it matters: it decides whether specs actually get shorter.

- **A (recommended). The reviewed part aims at 2,000 words, and `ura check` warns past 2,500. Each
  story shows two or three key scenarios, the others under "More scenarios". Past 6 stories, 30
  scenarios, or 2 changed decisions, the discovery proposes a split.**
  - [pro] a check that holds, and room left where a feature needs it.
  - [con] a warning to read on large features.
  - Why recommended: structure alone did not shorten specs, and a warning never blocks.
- **B. No number: a clear structure, key scenarios, and the moves of Q10 shorten the spec.**
  - [pro] nothing to count.
  - [con] nothing checks that specs got shorter.
- **C. `ura check` fails a spec past 2,000 words.**
  - [pro] specs stay short.
  - [con] a large feature must split even when it should not.

**Answer:** A: I want context in the clarifications to take the right decisions

Normally specs should only require a few short comments, if the flow is good and the model powerful

## Q10: What moves from the spec to the plan?

Architecture and details take a median 33% of a spec, up to 45%, and drew no comment. You said "Big
picture code architecture information is valuable". Plans already repeat the spec's file paths: 50
to 100% of them. Spec Kit keeps "no tech stack, APIs, code structure" out of the spec. More in
[discovery](discovery-01.md#what-the-spec-keeps).

Why it matters: it decides what you see before approving, and what only the agent reads.

- **A (recommended). The spec keeps the architecture's big picture: the main units, where each rule
  lives, and the tradeoffs, with a diagram for a flow. Data formats users edit, or that need a
  migration, stay too, as tables. Paths, signatures, internal types, hidden error handling, and the
  test table move to the plan.**
  - [pro] the spec shrinks by about a third, and keeps what you said you value.
  - [con] the plan, which you never review, holds the details.
  - Why recommended: the details drew no comment in 24 specs.
- **B. The details stay in the spec, folded, as today.**
  - [pro] everything in one file.
  - [con] the spec stays as long.
- **C. The details move to a new `design.md`, between the spec and the plan, which you may read.**
  - [pro] the details have a home of their own.
  - [con] a third file, and a new template.

**Answer:** A

## Q11: What goes in the right column on a wide screen?

The proposal leaves it open. The round of questions has a 240 px index with Submit. The session has
a "Progress" column. The [UI layout decision](/specs/decisions/ui-layout.md) allows a column for
what you need in view, foldable and resizable. Kiro's review shows an outline and a comments panel.
More in [discovery](discovery-01.md#the-right-sidebar-is-open).

Why it matters: it sets how you move through a long spec, and whether Approve stays in view.

- **A (recommended). An index of the spec's parts, decisions, and stories, each with its comment
  count. Approve and Request changes stay at its foot. Foldable and resizable, as the layout
  decision asks.**
  - [pro] jump to any part, and the verdict always in view.
  - [con] the reading column narrows by about 280 px.
  - Why recommended: it is the round's pattern, which you already use.
- **B. No column: the reading column gets the width.**
  - [pro] the widest text and mockups.
  - [con] no overview, and Approve is at the end.
- **C. The decisions and their state, new or changed, with a link to each.**
  - [pro] decisions stay in view.
  - [con] no way to jump to a story.

**Answer:** A

## Q12: How are data models written?

No `data-model.md` was ever written: data sits in the spec's "Data" bullets, 22 of 24 with inline
types. The diagrams decision allows Mermaid in data models, and says a diagram "MUST NOT repeat what
the text around it already says as a list". Mermaid's ER diagrams cannot type generics or unions;
its class diagrams can. Stripe lists each field as name, type, and a sentence. More in
[discovery](discovery-01.md#data-models).

Why it matters: data formats outlive features, and are what migrations change.

- **A (recommended). Every data shape is a table: field, type, meaning. A diagram is added for
  relationships between three or more entities, or for state transitions. `data-model.md` holds it
  past two entities; smaller shapes stay in the spec or plan.**
  - [pro] tables everywhere, and diagrams only where they add something.
  - [con] small models have no picture.
  - Why recommended: a table reads every shape; a diagram of one entity is a box with no lines.
- **B. Every data model is tables plus a Mermaid diagram, always.**
  - [pro] the same picture every time.
  - [con] diagrams that repeat the tables, against the diagrams decision.
- **C. Data stays as it is written today.**
  - [pro] no change.
  - [con] bullets with inline types.

**Answer:** A

## Settled without the human

- **Builds on the clarifications redesign** its writing reference, warnings, diagrams, and table
  floors. This feature's plan starts once that branch merges, and extends them rather than copying
  them. See [discovery](discovery-01.md#the-clarifications-redesign).
- **Branches in flight** rewrite their spec in the new format when they next move, as the
  compatibility decision asks. The spec names which branches are hit.
- **Answers to your last review** sit in a "Your review" section, on revisions only. Each names the
  comment in a few words, then says done or declined, and why. The page shows each beside your
  comment and its quote. Earlier review records move to the end of the spec, folded.
- **What you approve** becomes the block's first item: one sentence, then at most 7 items. Answers
  are paraphrased, never cited by number. Git chores leave the block.
- **Decision links** open the branch's version of the decision, with its change and its anchor.
  Comments on a decision go in `spec-review.md`, pointing to the decision's file and lines.
- **The constitution check** becomes one line, or a list of the principles in tension, each with its
  tradeoff. The constitution asks for a check, not a table.
- **Cuts**: "Relied on" decisions become one line of links. "Why this priority" stays only when the
  order is not obvious. Points settled in the clarifications are linked, not restated. UI strings
  stay only where the behaviour is the string.
- **Records** cite no ruling IDs: they say what changed, in words. Their format is unchanged
  otherwise, so the 26 records stay valid.
- **The time estimate** uses the clarifications redesign's formula: the reviewed words at 250 a
  minute, plus a minute per mockup and per changed decision, rounded up to 5.
- **Scenarios** keep Given, When, and Then, which the tests map to. Each stays at most 3 or 4 steps,
  as Cucumber recommends.
- **The writing reference** gains the spec's rules: no "C1" or "Q4" alone, each rule stated once in
  the spec, and terms defined at first use. The template stays a bare skeleton, and the example
  shows the shape.
- **The page jump** is fixed by keeping your reading place: the comment form no longer moves, and
  story frames above you resize without moving the text. Scroll anchoring is checked in WebKit
  first. See [discovery](discovery-01.md#scroll-anchoring).
- **The edit box** hides the frontmatter: the controls above it set those fields, and saving keeps
  them.
- **Plans** drop the constitution table and the decisions list they copy from the spec. Their page
  keeps today's task badges.
- **No second writing pass**: an agent writing a draft and another rewriting it for you was declined
  in the clarifications redesign, for two files that can disagree.
- **The reading measure** of the spec page is 75 characters, as the round's, for the same reasons.

**Notes:**

- **The constitution check**: Make it a small table with checks

  I | II | |✅|✅|

- **Cuts**: “Relied on” can be a small table imo (decision > impact on spec), will look better than
  just a sea of links
