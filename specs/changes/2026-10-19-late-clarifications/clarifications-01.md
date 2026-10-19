---
status: awaiting-human
---

# Clarifications, round 01: Clarifications during implementation can resume implementation

> [!IMPORTANT]
>
> 2 questions, about 5 minutes.
>
> - Verdict: worth building as proposed, with one catch. The choice must live in git, so it needs a
>   new key in the front matter of `clarifications-NN.md`. That is a file format change, a reason to
>   make this a feature.
> - What the new key means for the approved spec: it stays as approved, and the answers go into the
>   code and `rulings.md`.
> - The button shows only once the plan is being built: settled without you, below.

## Context

### Goal

The [proposal](proposal.md) wants a round of questions asked during implementation to end in one of
two ways. The human chooses when they answer: back to the spec's approval, as today, or straight on
with the implementation. Continuing is the usual case, so the round's end gets a primary button,
"Answer and continue implementing".

### Today

Nothing says a round was asked during implementation. The step finder
([`feature_step`](/crates/core/src/steps.rs)) sends an answered round whose number is above the
spec's `clarifications` to the spec step, whenever it comes. The spec is amended, approved again,
and the plan revised before the implementation goes on. The skill says so in
[Implementation, when you must stop](/skills/uraeda/references/implementation.md#when-you-must-stop).

The round's end is [`RoundEnd`](/packages/web/src/RoundSubmit.tsx), with
[`CommitActions`](/packages/web/src/CommitActions.tsx): "Commit and start the agent", and "Commit
only". Both lead to the spec step.

The next agent may be another session, days later. So the choice cannot live in the button only. It
has to be in the repository, or `ura next` would send the answered round to the spec step anyway.

### Scope

The round's end in the web UI, and the one place the choice is recorded in the files. Also the step
finder, and the skill's description of both. The spec step, the plan, and the CLI's answer command
are untouched, apart from what the questions below decide.

### Sources

- [`steps.rs`](/crates/core/src/steps.rs), the step table in code, and the
  [skill's table](/skills/uraeda/SKILL.md#finding-the-next-step).
- [Implementation](/skills/uraeda/references/implementation.md#when-you-must-stop) and
  [Change](/skills/uraeda/references/change.md#upgrading), for the stop and the upgrade rules.
- The [ui-behaviour](../../decisions/ui-behaviour.md) decision, for the web UI's rules.

## Q1: Make this change a feature?

Recording the choice needs a new optional key in the front matter of an answered round, for example
`resumes: implementation`. Rounds without it behave as today, so no existing file changes. Still, a
new key changes a file format. [Change](/skills/uraeda/references/change.md#upgrading) lists that as
a reason to make a change a feature, with its spec and plan.

Why it matters: a feature costs a discovery round, a spec to approve, and a plan, for a change you
called small. Staying a change costs you the spec's review of the key's exact shape: the pull
request shows it instead.

- **A (recommended). Stay a change.** The key is optional and additive, and nothing existing breaks.
  - [pro] one pull request, reviewed once.
  - [con] the file format is reviewed on the pull request, not in a spec.
  - Why recommended: your proposal is small, and the format change is one optional key.
- **B. Make it a feature.**
  - [pro] the key's shape and the new step are reviewed in a spec first.
  - [con] a spec to approve, then a plan, before any code.

**Answer:**

## Q2: What does "continue implementing" do to the approved spec?

Choosing it means the answers are small enough not to change the spec. The agent continues the
unchecked tasks of the plan with the answers applied, and writes each choice the answers made in
`rulings.md`. The spec and the plan stay as approved: the spec's `clarifications` counter is not
raised, so the spec's record does not claim it was amended.

Why it matters: later readers see the answers only in the round and in `rulings.md`, not in the
spec. If an answer turns out to be larger than it looked, the agent stops and starts a new round. It
does the same today for any conflict with the spec.

- **A (recommended). Leave the spec and the plan as approved, and keep the answers in the round and
  `rulings.md`.**
  - [pro] no new approval, which is what you want from the button.
  - [con] the spec can drift from the code by what the answers settled, until the record at the end
    shows them.
  - Why recommended: the answers are small by your own rule, and `rulings.md` is where such small
    choices already go.
- **B. Amend the spec's text for the answers, without asking you to approve it again.**
  - [pro] the spec stays the one source of truth.
  - [con] the spec changes without your approval, which the workflow never allows.

**Answer:**

## Settled without the human

### Check these

- **Where the button shows**: only when the spec is approved and the plan has unchecked steps. A
  round asked before the plan has one outcome, the spec step.
- **The buttons**: "Answer and continue implementing" is the primary button there. The other two
  stay, secondary, with "Answer and revise the spec" for the way back. Without an agent on the
  machine, one "Commit" button leads to the spec step, as before.

### Under the hood

- **A round without the key** is read as before, so old rounds and CLI answers keep the spec step.
- **The key is written with the answers** by the web UI and `ura answer --submit`, and a human can
  write it by hand, as every file is editable.

**Notes:**
