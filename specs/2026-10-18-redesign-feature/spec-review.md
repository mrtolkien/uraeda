---
verdict: changes-requested
commit: e298be3
---

# Review: Spec, Redesign feature and change pages

## C1: Lines 15–16, under "Spec: Redesign feature and change pages"

> > - You approve one page for every feature and change: its stages with their dates, what's next,
> >   the agent, and what it produced. A done one adds its figures and its record, drawn in place.

We need date/times, it'll usually be all in the same day so let's not make the page too cluttered

## C2: Lines 19–21, under "Spec: Redesign feature and change pages"

> > - Tokens: you asked to leave out cache reads and count fresh input. This spec counts cache
> >   writes as input too: fresh input alone is 2,700 tokens for a whole feature. Say so if you
> >   meant it alone.

I don't think that's a realistic fresh input value: total input should include all tool results so
this is ridiculously low. You're likely mis-understanding the numbers you get from Claude Code

## C3: Line 58, under "US1: See where a feature is and what's next (P1)"

> [Feature page, the agent building](/packages/web/src/mockups/FeaturePage.stories.tsx#Working)

Story FeaturePage.stories.tsx#Working, desktop, element with “Oct 17 · 2 h 50 min”: MAke sure the
content fits on a line OR is always on two lines. Here it just looks weird having a single two lines
field. Also it's the same date everywhere, a bit weird.

## C4: Line 58, under "US1: See where a feature is and what's next (P1)"

> [Feature page, the agent building](/packages/web/src/mockups/FeaturePage.stories.tsx#Working)

Story FeaturePage.stories.tsx#Working, desktop, element with “Lines changed+1,204 −31023 files”:
Lines changed need green/red like a normal diff: same in the sidebar

## C5: Line 58, under "US1: See where a feature is and what's next (P1)"

> [Feature page, the agent building](/packages/web/src/mockups/FeaturePage.stories.tsx#Working)

Story FeaturePage.stories.tsx#Working, desktop, element with “5.2 M in · 113 k out”: This should be
two clear lines or a single longer card: the line split after "113k" looks bad

## C6: Line 58, under "US1: See where a feature is and what's next (P1)"

> [Feature page, the agent building](/packages/web/src/mockups/FeaturePage.stories.tsx#Working)

Story FeaturePage.stories.tsx#Working, desktop, listitem with “proposal.mdcommitted”: Make the files
table more compact, there's a kilometer between the name on the left and the result on the side +
the colors are not clear (committed is grey but answered is green despite both meaning the step is
done) + the use of monospace for the files name sucks + we should use the different step icons

## C7: Line 60, under "US1: See where a feature is and what's next (P1)"

> [Feature page, waiting on you](/packages/web/src/mockups/FeaturePage.stories.tsx#WaitingOnYou)

Story FeaturePage.stories.tsx#WaitingOnYou, desktop, element with “!Agent · Waiting for youOpen the
session…”: I don't like that "Agent - Waiting for you" looks more important than the actual next
step which is "Review the spec".

In a normal step the "waiting agent" should be very neutral, maybe with a sleep icon.

## C8: Line 60, under "US1: See where a feature is and what's next (P1)"

> [Feature page, waiting on you](/packages/web/src/mockups/FeaturePage.stories.tsx#WaitingOnYou)

Story FeaturePage.stories.tsx#WaitingOnYou, desktop, element with “!Agent · Waiting for youOpen the
session…”: Next step + agent status should be on the same line, they're both very sparse

## C9: Line 85, under "US2: See what a done feature produced (P1)"

> [Feature page, done](/packages/web/src/mockups/FeaturePage.stories.tsx#Done)

Story FeaturePage.stories.tsx#Done, desktop, element with “Decisions2new or changed”: What can be
clickable should be clickable: decisions changes should show a diff of the decisions in the same
format as the specs

## C10: Line 125, under "US4: Open the session, with the message that applies (P1)"

> [Messages menu, open](/packages/web/src/mockups/ComposerMessages.stories.tsx#Open)

Story ComposerMessages.stories.tsx#Open, desktop, menu “Messages”: There will usually be a single
message, not sure we need a picker for that. An "insert recommended message" makes more sense.

## C11: Line 152, under "US5: Send the agent to the pull request's comments (P2)"

> [Feature page, pull request open](/packages/web/src/mockups/FeaturePage.stories.tsx#PullRequest)

Story FeaturePage.stories.tsx#PullRequest, desktop, element with “NextYour review on pull request
#31The a…”: This is EXACTLY what we said we would stop doing: two buttons opening the session
differently on the same page. Remove the "address the comments" button
