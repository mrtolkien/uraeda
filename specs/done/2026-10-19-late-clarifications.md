---
kind: change
finished: 2026-10-19
pull-request: https://github.com/mrtolkien/uraeda/pull/44
---

# Record: Clarifications during implementation can resume implementation

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19, in [its pull request](https://github.com/mrtolkien/uraeda/pull/44). Its full files are
> in git: `git log -- specs/changes/2026-10-19-late-clarifications/`.

## What and why

A round of questions asked during implementation could only go back to the spec's approval. Every
such round so far was small enough to carry on building after the human's review. The human now
chooses when they answer: back to the spec, or continue implementing, which is the usual case.

## Behaviour

- A round of the web UI asked while the spec is approved and the plan has an unchecked step ends
  with a primary "Answer and continue implementing" button. "Answer and revise the spec" is the way
  back, and "Commit only" stays.
- Continuing writes `resumes: implementation` in the round's front matter. The spec and the plan
  stay as approved, and the agent applies the answers in the unchecked tasks, writing each choice in
  `rulings.md`. An answer that changes the spec's behaviour, a decision, or a built task is a new
  round.
- The key counts only while the implementation is under way. A submit without it removes a leftover
  key. `ura answer --submit --resume` writes it, and is refused outside the implementation.
- Rounds without the key, the triage, and a machine without an agent behave as before.

## Design

The step finder reads the key of the latest round in [`feature_step`](/crates/core/src/steps.rs),
with [`building`](/crates/core/src/steps.rs) deciding whether the implementation is under way. The
core's [`record`](/crates/core/src/actions/answer.rs) writes or removes it, through the binding and
the server's `answers.submit`. The file's view carries `resumable`, which
[`RoundEnd`](/packages/web/src/RoundSubmit.tsx) reads to draw the buttons of
[`CommitActions`](/packages/web/src/CommitActions.tsx). The skill's step table,
[implementation](/skills/uraeda/references/implementation.md#when-you-must-stop), the status table,
and the CLI's reference describe it.

## Questions

### Round 01

#### Q1: Make this change a feature?

**Answer:** A. Stay a change: the key is optional and additive.

#### Q2: What does "continue implementing" do to the approved spec?

**Answer:** A. Leave the spec and the plan as approved, and keep the answers in the round and
`rulings.md`.

## Changes after approval

- The step finder ignores the key outside an implementation under way, and a plain submit removes
  it.
- The notes' format moved from `SKILL.md` to the writing rules, since the entry point was already
  over its size limit.

## Follow-ups

- The web test `home.test.tsx` ("shows the four counts…") and a bundle test fail in this
  environment, apart from this change.
