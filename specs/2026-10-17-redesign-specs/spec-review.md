---
verdict: changes-requested
commit: de46926
---

# Review: Spec, Redesign and reword specs

## C1: Line 69, under "US2: Decisions come first, each change marked in place (P1)"

> [Decision change](/packages/web/src/mockups/DecisionChange.stories.tsx#Change)

Story DecisionChange.stories.tsx#Change, desktop, element: Need to have a maximum width, in the
preview at least it's way too wide and hard to read!

## C2: Line 69, under "US2: Decisions come first, each change marked in place (P1)"

> [Decision change](/packages/web/src/mockups/DecisionChange.stories.tsx#Change)

Story DecisionChange.stories.tsx#Change, desktop, element: You're striking out the removed text,
making it hard to see what was removed. It's exactly what we don't want. Just add a red background
without a strikethrough _only_ for full rule deletion.

## C3: Line 99, under "US3: Stories read as cards (P1)"

> [Spec page](/packages/web/src/SpecPage.stories.tsx#Waiting)

Story SpecPage.stories.tsx#Waiting, desktop, element: Still feel like a block of text:

- First lines should have bigger text, atm it's a bit smaller than the rest for some reason
- Rules should have some hierarchy and not just a light gray vertical spacer. Also rules should be
  ordered by importance inside a decision
- Use icons for rules, maybe ++ or double up arrow for MUST, single + or up arrow for SHOULD, - for
  SHOULD NOT, -- for MUST NOT. Use nice icons that will play well with the page, not emojis.

## C4: Line 99, under "US3: Stories read as cards (P1)"

> [Spec page](/packages/web/src/SpecPage.stories.tsx#Waiting)

Story SpecPage.stories.tsx#Waiting, desktop, element: Start with the decision title before the pills

## C5: Line 181, under "Edge cases"

> ## Edge cases

The Edge cases part is still hard to read right now, we need dedicated parsing + rendering to make
it digestable. There should be an importance indicator on each row (some edge cases really are niche
and the model knows that)

## C6: Line 99, under "US3: Stories read as cards (P1)"

> [Spec page](/packages/web/src/SpecPage.stories.tsx#Waiting)

Story SpecPage.stories.tsx#Waiting, desktop, element: Commented below: I want special rendering for
each part: edge cases, success criteria, architecture, assumptions, constitutions. You are allowed
to re-order them too.
