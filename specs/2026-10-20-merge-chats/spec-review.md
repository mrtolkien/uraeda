---
verdict: changes-requested
commit: 44bca1a
---

# Review: Spec, Merge chats and changes

## C1: Lines 21–22, under "Spec: Merge chats and changes"

> > - My reading of your later message: "a new session" for a change or a feature is the build's
> >   fresh-session switch, now offered on every message, in the same session page.

Not on "every message" ffs, we need a "start a new session" button in the change/feature page, and a
list of attached sessions.

## C2: Decision agents, lines 26–29, under "Rules"

> - Every conversation with an agent MUST be a session, and a change or a feature MUST have one
>   session, in its worktree and with the server's copy of the skill, where runs and the human's
>   messages follow each other and the agent acts on a message only when asked. Checked by the
>   runner's tests.

Nope, it has one OR MORE SESSIONS attached, all in the worktree

Technically sub-agents are session btw

## C3: Decision agents, lines 32–33, under "Rules"

> - A session MUST keep its conversation when it becomes a change, or its change a feature. Checked
>   by the runner's tests.

Does it really make sense to make that a rule? It's fucking obvious

## C4: Line 58, under "US1: One list of sessions (P1)"

> [Merged sidebar](/packages/web/src/sidebar/Sessions.stories.tsx#Merged)

Story Sessions.stories.tsx#Merged: We need some visual differentiation for basic session, change,
and feature. It's messay atm, for example the agent pills are not all aligned vertically. Also there
should be a `...` everywhere that helps us also rename sessions.

While we're at it let's remove the "feature color" concept, it's bad and unused.

## C5: Line 60, under "US1: One list of sessions (P1)"

> [Nothing in flight](/packages/web/src/sidebar/Sessions.stories.tsx#Empty)

Story Sessions.stories.tsx#Empty: Important point: a "done" session is a session where the human has
seen the last message. A done change or feature is one where the PR was merged.

## C6: Line 89, under "US2: A session grows into a change (P1)"

> [Once started](/packages/web/src/NewSession.stories.tsx#ChangeStarted)

Story NewSession.stories.tsx#ChangeStarted, desktop, button “Make it a change”: Why is there still
the "make it a change" button if it's now a change?

## C7: Line 87, under "US2: A session grows into a change (P1)"

> [The offer](/packages/web/src/NewSession.stories.tsx#ChangeOffer)

Story NewSession.stories.tsx#ChangeOffer, desktop, button “Make it a change”: Button is not
aligned + it should be grouped in a "session actions" menu that also has archiving.

## C8: Line 148, under "US4: A change grows into a feature, in place (P2)"

> [The offer](/packages/web/src/NewSession.stories.tsx#FeatureOffer)

Story NewSession.stories.tsx#FeatureOffer, desktop, button “Make it a feature”: Same issue as the
other button, it's in a weird spot and will be hard to see and reach in bigger sessions. It should
be close or a part of the composer.

## C9: Line 177, under "US5: A new agent session in a change or a feature (P3)"

> [In a new session](/packages/web/src/NewSession.stories.tsx#NewSessionOn)

Story NewSession.stories.tsx#NewSessionOn: Nope, not good. Each session should have its own page. A
new session in change/feature (so in the worktree) should come from the own's change/feature page.
Both sessions should still exist, attached to the change/feature. Ideally sub-agents should be
listed there too.
