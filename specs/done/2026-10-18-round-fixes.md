---
kind: change
finished: 2026-10-19
pull-request: https://github.com/mrtolkien/uraeda/pull/43
---

# Record: Round fixes

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-18, finished on
> 2026-10-19, in [its pull request](https://github.com/mrtolkien/uraeda/pull/43). Its full files are
> in git: `git log -- specs/changes/2026-10-18-round-fixes/`.

## What and why

Fifteen small defects found while reviewing the round page, its checks, and their tests: wording,
warnings that misfired or were missing, a heading dropped without a word, duplicated readings, and
tests that started from an old round format.

## Behaviour

- The settled fold reads "Show the point" for a single point, "Show the N points" otherwise.
- `block.count` does not warn on a round sent back for blank answers, whose first line is "2
  questions still need an answer: Q3 and Q5".
- A comment typed with no letter picked, starting like "B: ..." or "B, ...", warns that it reads as
  that letter picked and opens its follow-ups.
- On the phone, the band before the settled points is drawn only when the round has some.
- `ura check` reports a `####` heading in a clarifications round's Context or settled section as an
  unknown section: the page drops it.
- A `##` heading inside a quote no longer ends a section, so the settled points, spec parts, and
  rulings after it are kept.
- The phone's in-page index is announced as Questions once: the nav is named by its heading.
- The round cards' accent lines are 4 px at every size.

## Design

Root causes, one commit each. `section()` stopped at any heading, quoted ones included, while
`parts()` already skipped them: [items.rs](/crates/core/src/files/items.rs). The settled groups and
points now come from one reading, `settled_parts`, in
[round.rs](/crates/core/src/files/items/round.rs). `SettledGroup.kind` is the `SettledKind` enum,
which the web's `LOOKS` covers exhaustively
([SettledGroups.tsx](/packages/web/src/SettledGroups.tsx)). `check_file` parses a round's document
tree once ([mod.rs](/crates/core/src/check/mod.rs)). The comment warning uses a TypeScript port of
the core's letters rule, [readLetters.ts](/packages/web/src/readLetters.ts), shown by
[QuestionComment.tsx](/packages/web/src/QuestionComment.tsx). The accent width is the
`--size-round-accent` token. The six inline test rounds follow the current template, with new
browser tests for the cards in `round-cards.test.tsx`.

## Changes after approval

- A chat's title in the sidebar wraps instead of being cut by an ellipsis, which fixes the sidebar
  browser test that failed on the default branch ([Row.tsx](/packages/web/src/sidebar/Row.tsx)).

## Follow-ups

- `ura check` misses a `####` heading in the triage's Context, and parses a triage that is not
  waiting.
- `readLetters.ts` is a hand copy of the core's rule: share its test rows through `fixtures/`; its
  warning also mentions follow-ups on questions that have none.
- The 4.8 px accent width and the once-on-mount split threshold could not be reproduced by a failing
  test.
