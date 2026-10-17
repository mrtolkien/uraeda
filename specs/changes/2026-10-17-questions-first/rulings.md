# Rulings: Questions first

The low-impact choices made while building [the change](proposal.md), inside the limits of the
proposal and the decisions. None binds future work: those are decisions.

## R1: The index shows in the round itself, on narrow screens only

- **Decision**: on a phone, a round waiting for answers shows a "Questions" list of every applicable
  question and follow-up, marked ✓ or ○, right under its `> [!IMPORTANT]` block and before its
  context. A tap brings that question to the top. Wide screens keep the column beside the questions,
  and no list in the page.
- **Rationale**: the proposal names the phone, where the index sat behind the top bar's "1/4" count,
  and the desktop's column already shows every question. The block says how many questions there
  are, so the list reads as its continuation, before the first question can be answered.
- **Alternatives considered**: the list on wide screens too, which repeats the column beside it. A
  list of questions written in `clarifications-NN.md` itself, which changes the round's file format,
  for every project and tool: a reason to make it a feature.
- **If wrong**: removing the list's line in [the round page](/packages/web/src/RoundPage.tsx) undoes
  it.
- **Where**: [`RoundIndex`](/packages/web/src/RoundNav.tsx), placed by
  [`RoundOpening`](/packages/web/src/RoundOpening.tsx).

## R2: The top bar keeps its count and its sheet

- **Decision**: the "1/4" button, its sheet of the questions, and Next stay in the phone's top bar.
- **Rationale**: once the human scrolled past the list, the sheet is the index still in reach, as
  the [UI improvements](/specs/done/2026-10-12-ui-improvements.md) record chose.
- **Alternatives considered**: dropping the sheet now that the round starts with the list, which
  leaves no index halfway down a long round.
- **If wrong**: the sheet goes with its button in [`RoundNav`](/packages/web/src/RoundNav.tsx).
- **Where**: [`RoundNav`](/packages/web/src/RoundNav.tsx), unchanged.
