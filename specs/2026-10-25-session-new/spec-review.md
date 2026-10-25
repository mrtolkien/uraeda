---
verdict: approved
commit: a521179
---

# Review: Spec, Session and New in the terminal look

## C1: Lines 18–19, under "Spec: Session and New in the terminal look"

> > - The column's split is a second shape of right column, beside the documents' tabs: the feature
> >   page will reuse its parts, the activity, the changes, and the progress.

We should likely have a "Panel" (or better name) abstraction that can be shown either as a tab or
inside a vertical split of a tab.

This way it all behaves the same, and this vertical split is just a type of Panel itself holding 2
Panels.

## C2: Lines 54–56, under "US1: Read the chat, with what the agent did beside it (P1)"

> A human follows a session. The chat holds their messages and the agent's words, with one recap
> line for each stretch of tool calls and thoughts between them. The column beside it lists every
> call and thought, grouped by run, and a recap line opens the column at its stretch.

Make the right column a bit less wide on semiwide screens. The center content should CLEARLY have
more importance and higher visual weight.

## C3: Lines 146–148, under "US5: Pick the right kind on New (P2)"

> A human opens New and sees three cards side by side, Session, Change, and Feature. Each has its
> name, one sentence, what it ends with, what waits on them, and an example. The picked card's form
> sits under the cards.

The cards in the mockup looked quite a bit better

Make sure:

- The text is readable, right now "Ends with" is 10km from the text
- You use icons to make things clear
- There's no round radio button (there's nothing round in the UI)
