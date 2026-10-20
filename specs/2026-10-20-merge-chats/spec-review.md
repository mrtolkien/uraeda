---
verdict: changes-requested
commit: e0aa6d0
---

# Review: Spec, Merge chats and changes

## C1: Line 78, under "US1: One list of sessions (P1)"

> [Merged sidebar](/packages/web/src/sidebar/Sessions.stories.tsx#Merged)

Story Sessions.stories.tsx#Merged, desktop, element with “Feature”: I don't like the pill that takes
a full line just for this. I prefer icons.

## C2: Line 143, under "US3: One "＋ New" starts anything (P2)"

> [New, Session](/packages/web/src/NewSession.stories.tsx#NewSessionPage)

Story NewSession.stories.tsx#NewSessionPage, desktop, element with “Talk with the agent in the main
checkout…”: Why do we have an explanation for the Session only, which is the most obvious thing, but
not for a change or feature lol

Add a small explanation for all three, maybe with a small diagram of core human steps for change and
features (changes is prompt -> optional questions -> PR, feature is prompt > questions > spec > PR)

## C3: Line 172, under "US4: A change grows into a feature, in place (P2)"

> [The offer](/packages/web/src/NewSession.stories.tsx#FeatureOffer)

Story NewSession.stories.tsx#FeatureOffer, desktop, menu “Session actions”: Add a "abandon this
change" (or better wording) option
