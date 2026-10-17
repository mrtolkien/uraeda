---
kind: change
finished: 2026-10-17
pull-request: https://github.com/mrtolkien/uraeda/pull/32
---

# Record: Questions first

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-17, finished on
> 2026-10-17, in [its pull request](https://github.com/mrtolkien/uraeda/pull/32). Its full files are
> in git: `git log -- specs/changes/2026-10-17-questions-first/`.

## What and why

The human wanted a round of questions to start with a list of all its questions, so they do not
answer a later question early, in an earlier one's comment. Wide screens had the list in the column
beside the questions, but on a phone it sat behind the top bar's "1/4" count, with no quick way to
see the questions.

## Behaviour

- On a phone, under 768 px, a round waiting for answers shows a "Questions" list right under its
  `> [!IMPORTANT]` block, before its context: every applicable question and follow-up, marked ✓ or
  ○, a tap bringing that question to the top. The inbox triage, a round too, shows it the same way.
- Wide screens keep the column beside the questions, and no list in the page.
- The phone's top bar keeps its count, its sheet of the questions, and Next, for an index in reach
  once the list is scrolled past.
- An answered round shows no list, as it shows no navigation.

## Design

[`RoundIndex`](/packages/web/src/RoundNav.tsx) is the list of the top bar's sheet, `Index`, under a
"Questions" heading, its rows jumping with the same `jumpTo`.
[`RoundPage`](/packages/web/src/RoundPage.tsx) passes it to
[`RoundOpening`](/packages/web/src/RoundOpening.tsx), which draws it between the block and the
context, when the round navigates and the width class is narrow. The round's file format is
unchanged: a list written in `clarifications-NN.md` would have changed it for every project and
tool, which makes a feature.

## Follow-ups

- The in-page list has no test that it is hidden on an answered round, nor that it sits after the
  block (inbox, **Deferred fixes**).
- A screen reader hears "Questions" three times, as the navigation, its heading, and its list
  (inbox, **Deferred fixes**).
- `RoundPage`'s comment on its navigation does not name the phone's in-page list (inbox, **Deferred
  fixes**).
