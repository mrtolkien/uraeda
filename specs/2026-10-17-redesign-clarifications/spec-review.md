---
verdict: changes-requested
commit: f7a8d6b
---

# Review: Spec, Redesign clarifications

## C1: Lines 18–20, under "Spec: Redesign clarifications"

> > - [Compatibility](../decisions/compatibility.md): no backward compatibility before 1.0, as your
> >   note asked. Every round written in the old format fails `ura check` once this merges. No
> >   branch in flight holds one today.

The expected behaviour should be that on `ura check` failing, the agent fixes it anyways, right?
Shouldn't be a big deal

## C2: Lines 21–23, under "Spec: Redesign clarifications"

> > - Your "MORE context, do not limit it" is read as: no length limit on a question's context. The
> >   sentence-length warning you picked still applies everywhere, context included. Long context
> >   splits into short sentences, tables, quotes, and diagrams.

Yes, we need to steer the model towards giving _adequate_ context to the question

## C3: Line 75, under "US2: The round opens with its verdict and its typed facts (P1)"

> [Round waiting for answers](/packages/web/src/RoundPage.stories.tsx#Waiting)

Story RoundPage.stories.tsx#Waiting, heading “When does the next occurrence appear?”: Is it possible
to always keep the question title visible on mobile?

## C4: Line 75, under "US2: The round opens with its verdict and its typed facts (P1)"

> [Round waiting for answers](/packages/web/src/RoundPage.stories.tsx#Waiting)

Story RoundPage.stories.tsx#Waiting, element: Tables render poorly on mobile: they should have a
reasonable minimum width per column and be scrollable horizontally

## C5: Line 75, under "US2: The round opens with its verdict and its typed facts (P1)"

> [Round waiting for answers](/packages/web/src/RoundPage.stories.tsx#Waiting)

Story RoundPage.stories.tsx#Waiting, element: This is too much borders and offset in mobile, leaving
too little space for the content. Make it much more compact on mobile. Keep it pretty close to the
current look and feel.
