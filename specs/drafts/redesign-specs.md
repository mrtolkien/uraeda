---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Redesign and reword specs

## What

Redesign and reword specs and the other agent-generated pages (plans, data models, ...). The goal is
READABILITY: rewording and redesign go together, the skill and the templates change with the UI.

- Decisions can't be accessed with the generated links (example: basic security spec) + they should
  be EXTREMELY HIGH priority and show a diff: a decision is the main thing that stays from a branch
  and represents explicit human approval.
- Specs are still way too long and hard to read, with tens of bullet points (examples: "run ui")
- For example specs are very hard to read at the moment, there's no clear user stories UI, it's a
  sea of bullet points, ...
- Generally _all_ agent-generated pages need to have good formatting, adapted for the page: cards
  for user stories, tables, ...
- We should have color and hierarchy for specs and plans
- Data model pages (data-model.md) should read like an actual table with proper table formatting. We
  could force mermaid graph + rendering for example.
- Parsed frontmatter should not appear in the edit box
- The wording and style must be model-agnostic: we need to be extremely clear as to the format
  expected, the tone, ...
- Sometimes the spec quotes "Your Q4 answer" but I don't remember what it was: the spec should be
  fully readable WITHOUT ANY CONTEXT.
- TODO: Define what goes in the right sidebar on desktop!
- Sometimes when I comment the page jumps around. Might be due to storybook embeds loading or
  something?

- When I pick an element and try to comment on storybook, sometimes the element name seems
  problematic:
  - "Story WorkList.stories.tsx#Selected, desktop, element"

## Why

Approving a spec is the human's most important job, and today it's a sea of bullet points.

## Notes

- I'll do page-by-page passes on the formatting.
- Same model-agnostic wording work as in the
  [clarifications redesign](redesign-clarifications/proposal.md).

## Findings from the workflow review

From a review of 16 specs (2026-10-13 to 2026-10-16, both redesign branches, and nvim-plugin), each
read at the commit before its approval, with its review files, the rounds after approval, and the
records. The yardstick is the example spec,
[`recurring-tasks/spec.md`](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/spec.md):
2,194 words, 4 stories, 14 scenarios.

### What the human reads

All 37 comments of the review files landed on the `[!IMPORTANT]` block or the summary (15), the
mockups or stories (14), the spec as a whole (6), the record's format (2), and one success
criterion. None landed on architecture, assumptions, decisions relied on, the constitution check,
components, error handling, or testing: 30 to 50% of every spec. In the two redesign specs, 11 of 13
comments are on mockups.

### Length

- Specs run 3,900 to 7,700 words, 2 to 3.3 times the example. They averaged 5,054 words before the
  human-first layout, and 5,474 after: folding alone did not shorten them. Even folded, 2,100 to
  4,200 words stay visible, 9 to 19 minutes of reading.
- The block's estimate (20 to 45 minutes) is about twice the real time to approval, about 15
  minutes. testing-review claimed 25 and was approved in 3, nvim-plugin 40 for 8.
- redesign-interface has 9 stories, 56 scenarios, and 6 new or changed decisions, and claims 45
  minutes. The self-review's "fits a single plan" has no threshold, so it never fires.

### What works, and what fails

- The block works when it says how one of the human's answers was read: about 8 of the 15 comments
  on the block correct such a reading, before any code is written.
- It fails when a risk is described as a mechanism. ui-iteration wrote "The `Origin` rule is laxer,
  on those paths only"; a later round had to say "any website open in your browser can read the
  project's code".
- Records of earlier reviews stay above the summary. In text-inputs, revision 2 still opened with
  revision 1's record ("one growing text area"), which caused "That's the OPPOSITE of what I asked".
  The final ui-iteration spec opens with 4 such records, about 620 words.
- Objections hide in scenarios: chat's 15-minute idle close was scenario 7 of story 1.

### What the spec is worth afterwards

- Plans (6,000 to 17,000 words) redo the spec's architecture in more detail, and rulings add 2,000
  to 16,000 words. Records list 4 to 27 changes after approval.
- The spec is deleted at finish, and the record is rewritten from the code: the record, not the
  spec, is what a later reader finds. Records cite 5 to 51 ruling IDs ("R17") that point into
  deleted files; the example record teaches it, with "(ruling R3)".

### Ceremony

- The constitution check is "yes" in all 120 rows of 20 specs. It missed multi-repo-server's
  binary-size exception and ui-iteration's security hole.
- "Relied on" decision lists run up to 9 entries; "Why this priority" is usually filler; assumptions
  restate what the clarifications already settled.

### Writing

Against the example: possessive chains 9 to 30 per 1,000 words (4.6), semicolons up to 15 per 1,000
(2.3), 40 to 89 distinct paths (23), sentences of 18 to 30 words. redesign-priorities quotes 165 UI
strings. Terms appear in the block before they are defined ("the rail", "cards in flight", "frame
secret"); answers are cited by number alone ("Your Q4 answer"); git chores sit in the block ("your
local main and origin/main have diverged"); basic-security restates its frame-secret rule in about 7
sections.

### Proposed changes

1. **Open with what is being approved**, in one sentence, then a capped block, about 7 items or 150
   words: how each answer was read, paraphrased, never by number; new and changed decisions, one
   line each; risks as what a user or an attacker could do; unverified outside behaviour; what was
   left out. No process or git chores.
2. **Then the mockups**, as a "What you'll see" gallery.
3. **Only the current block at the top**: earlier review records move to a history at the end.
4. **A budget for the reviewed part**: about 1,500 to 2,000 words, the example's size. Each story
   gets a one or two sentence journey, its mockup, and 2 to 4 key scenarios; the rest folds.
5. **Move to the plan**: component paths and signatures, the testing table, internal data types,
   error handling users don't see. Keep data formats users edit or that need migrating.
6. **Cut**: the constitution table to one line unless a principle is in tension (the constitution
   requires a check, not a table: the human's call); "Relied on" to a line of links; "Why this
   priority" unless it isn't obvious; restated clarifications, replaced by a link; most exact UI
   strings; ruling IDs in records, starting with the example's.
7. **Propose a split** past 6 stories, about 30 scenarios, or 2 changed decisions.
8. **Compute the time estimate** from the reviewed part: about 200 words a minute, plus a minute per
   mockup.
9. **Self-review**: define every coined term at first use, never cite an answer by number alone,
   state each rule once and link to it elsewhere.
