---
verdict: changes-requested
commit: 724e317
---

# Review: Spec, Redesign session

## C1: Lines 25–26, under "Spec: Redesign session"

> > - Unverified: that the agent's CLI takes several rules in one start. Its help says so. If it
> >   does not, "Allow all" reopens the process once per rule.

That sounds like a failure waiting to happen. If it can't take several rules, stop and come back to
me.

## C2: Line 62, under "US1: Open a big session fast (P1)"

> [The button above a session's first shown message](/packages/web/src/SessionMockups.stories.tsx#Reading)

Story SessionMockups.stories.tsx#Reading, phone, element with “Message Claude CodeArchive”: The
background color of the composer is different than the rest of the page

## C3: Line 94, under "US2: Read on a phone (P1)"

> [A reply on a phone](/packages/web/src/SessionMockups.stories.tsx#Reading)

Story SessionMockups.stories.tsx#Reading: Go lower than 12px. Let's try 8px.

## C4: Line 122, under "US3: Allow all blocked actions (P2)"

> [Two actions blocked, with "Allow all (2)" above the composer](/packages/web/src/SessionMockups.stories.tsx#Blocking)

Story SessionMockups.stories.tsx#Blocking, desktop, element with “2 actions blocked by auto
modeAllow all…”: Hard to read, the text is very far from the "Allow all" button. I'm not sure we
even need that text on the left, I feel like `allow all` should be at the bottom, close to the
composer "sent" button.

## C5: Line 151, under "US4: Actions by the composer (P2)"

> [Reading above the end](/packages/web/src/SessionMockups.stories.tsx#Scrolled)

Story SessionMockups.stories.tsx#Scrolled, phone, button “Jump to the latest”: Should be centered
