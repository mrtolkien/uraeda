---
kind: change
finished: 2026-10-18
pull-request: https://github.com/mrtolkien/uraeda/pull/35
---

# Record: Skill wording fixes

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-18, finished on
> 2026-10-18, in [its pull request](https://github.com/mrtolkien/uraeda/pull/35). Its full files are
> in git: `git log -- specs/changes/2026-10-18-skill-wording/`.

## What and why

The skill's references, templates, and example had drifted from the rules they state: sentences over
25 words, a few rules that disagreed with their template or example, a dead link, and a round with
follow-ups the core cannot show. The human listed the fixes in one proposal.

## Behaviour

- Every sentence over 25 words in `README.md` and the references `change.md`, `plan.md`,
  `writing.md`, `discovery.md`, `cli.md`, `spec.md`, and `conventions.md` is split or listed, with
  no rule changed.
- [`spec.md`](/skills/uraeda/references/spec.md) left-aligns the constitution table like its
  template, its template's "You approve" item is one sentence like the rule says, and its Rules line
  lists MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY.
- The rules for writing tests live in
  [`code-quality.md`](/skills/uraeda/references/code-quality.md#writing-tests), which now has six
  concepts. `spec.md`, `plan.md`, and `change.md` link them.
- A review-focus item has its row in the test map, named "Review focus:", in the template and in the
  example's plan.
- The time of a spec's revision counts what changed since the last review, and its review answers.
- `conventions.md` says a round's Context and settled points may hold the template's own `###`
  headings, and no others. `change.md`'s link to the implementation step points to `#each-task`.
- The benchmarks round's follow-ups shared by two options are one each, `Q1.A` and `Q1.C`, `Q8.A`
  and `Q8.C`, and its long sentences are split.

## Design

Only text changed: the skill's references, templates, and example, `README.md`, and one backlog
round, never the code. The sentence limit was checked with a script that counts like the core's
`writing.sentence` rule, since `ura check` does not read the references.

## Changes after approval

- A revision's review time counts only what changed since the last review, a choice the proposal
  left open.

## Follow-ups

- About 80 sentences over 25 words remain in the references the proposal did not list:
  `implementation.md`, `finish.md`, `inbox.md`, `projects.md`, `approval.md`, and `code-quality.md`.
