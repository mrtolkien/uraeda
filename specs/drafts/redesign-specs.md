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
