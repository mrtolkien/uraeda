---
status: answered
---

# Clarifications, round 01: Decisions pass

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building, with changes. The rules already ask for few specifics and did not hold,
>   so it needs a measure and a rewrite, not only a reminder.
> - What counts as a decision: the bar's wording and its limits, which last beyond this feature.
> - The coherence check: how it runs, what it covers, and where its answers land work together.
> - The existing 21 decisions: rewriting them all would break the split rule.
> - UI coherence: your example, asked here since only an answer can create a decision.

## Context

### Goal

Make decisions carry your intent and goals, not specifics the code holds, so each is quick to
review. Add a check that finds decisions competing with each other or the constitution. Draw rules
on the decisions page as the spec page does.

### Today

- 21 decisions hold 11,152 words, 7 to 10 rules each, with values like `--permission-mode auto`, a
  15-minute idle close, and 17 px body text. See [agents](/specs/decisions/agents.md) and
  [UI layout](/specs/decisions/ui-layout.md).
- The skill's [bar](/skills/uraeda/references/spec.md#what-is-a-decision) is three tests, and
  `ura check` warns only past 10 rules.
- The [inbox triage](/skills/uraeda/references/inbox.md#the-triage) is the pattern for a checking
  run: an agent writes questions, you answer them, an agent applies them.
- The spec page draws a rule with a coloured strength icon and a muted check line. The decisions
  page draws the same rule as plain text.

### Scope

- Covers: the bar for decisions, the coherence check, the decisions page's rule display, and the
  pass over existing decisions.
- Leaves out: the benchmark branch's proposed decision, which stays on its branch.

### Sources

- The skill's decision rules, the ledger, the triage's code, the decisions page, and the
  [ADR practice](https://adr.github.io/). The full investigation is in [discovery](discovery-01.md).

## Q1: What makes something a decision?

The skill's three tests let specifics through. An agent would not guess it, it outlives the feature,
and getting it wrong is costly. For example, an agent would not guess `--permission-mode auto`, and
it matters. Architecture decision records keep to "architecturally significant" choices. A decision
that Spec redesign shortened still ended at 10 rules. More in
[discovery](discovery-01.md#what-makes-a-decision).

Why it matters: it decides what you review in every future spec, and whether the ledger stays
readable.

- **A (recommended). Add a fourth test, "intent, not mechanism", with examples, in the skill's one
  home for the bar.** A decision states a goal or an approach that binds other work. A value, a
  flag, a timeout, or a path belongs to the code, unless you state it as a hard constraint.
  - [pro] gives agents a test to apply and you a reason to reject a proposal.
  - [con] still a judgement, so it needs the measure of Q2 beside it.
  - Why recommended: the existing tests are already judgements that failed alone.
- **B. Change no rule, and only rewrite the ledger.**
  - [pro] no new rule to learn.
  - [con] new proposals drift back to specifics, as the benchmark one did.
- **C. Two tiers: a short decision, and a detail file of hard constraints linked from it.**
  - [pro] constraints keep a home.
  - [con] two files to review, and the detail grows into what you dislike.

**Answer:** A

## Q2: How is a decision's length limited?

Today only the rule count is measured: `ura check` warns past 10. Nygard's records are one or two
pages. The ledger's largest decision is 760 words. Works with Q1.

Why it matters: a measure warns every agent at once, where a judgement relies on each reading.

- **A (recommended). Lower the rule count to 6 and warn past 350 words, with `ura check`.** Both
  warn, as the 10-rule limit does, and you can approve an exception.
  - [pro] a measure the agent sees before you do.
  - [con] a hard decision, like security, may need more and ask an exception.
  - Why recommended: the earlier answer to "naturally fewer rules" left the limit at 10 and nothing
    changed.
- **B. Keep 10 rules and add only the word limit.**
  - [pro] fewer rewrites of rules.
  - [con] ten rules of 35 words are still ten things to review.
- **C. Measure nothing, rely on Q1.**
  - [pro] nothing to build.
  - [con] the failure of the last pass.

**Answer:** C: It's the failure of the last pass but we're changing how it works. You should review
the existing decisions though, which you can compare against actual logs/answers I gave.

## Q3: How does the coherence check run?

You want an option like the inbox triage, which raises competing decisions with the two ways to keep
it clean. The triage has two chat messages, a web page, and core code for its file. See
[discovery](discovery-01.md#how-the-coherence-check-runs).

Why it matters: a copy of the triage doubles parts that must stay in step.

- **A (recommended). A file of questions, `specs/DECISIONS-CHECK.md`, like the triage, sharing its
  reader, page, and messages.** One button on the decisions page starts it. You answer in the
  questions view.
  - [pro] asynchronous, plain text in git, as the constitution asks.
  - [con] a refactor of the triage's code to share it.
- **B. A separate copy of the triage, for decisions.**
  - [pro] no change to the triage.
  - [con] two copies of one rule, against the constitution's single home.
- **C. Skill only: a chat message starts it and you answer in the chat.**
  - [pro] nothing to build but a reference.
  - [con] not resumable from the repository alone, which principle III asks for.

**Answer:** A: It should also re-use the decision diff view we use for specs

## Q4: What does the check look for?

Conflicts between decisions, or with the constitution, are the proposal's ask. Two decisions that
state one rule, and decisions too specific for Q1's bar, are neighbours. Works with Q6: with the
third, the check is the pass over existing decisions. See
[discovery](discovery-01.md#what-the-check-covers).

Why it matters: a wider check finds more, and each finding is a question you answer.

- **A (recommended). Conflicts, overlaps, and decisions that fail the bar of Q1.** Each finding is a
  question with the two ways to keep the ledger clean.
  - [pro] one run finds what the pass needs.
  - [con] more questions per run.
- **B. Conflicts and overlaps only.**
  - [pro] findings are objective.
  - [con] too-specific decisions need a second tool.
- **C. Conflicts only.**
  - [pro] smallest.
  - [con] leaves duplicates and noise.

**Answer:** A

## Q5: Where do the check's answers land?

The triage works on the default branch. Decisions change only on a branch, `proposed`, until you
approve ([how](/skills/uraeda/references/spec.md#new-decision-or-change)). Your answer picks a way
out, but you have not read the edited text.

Why it matters: edits on the default branch skip your review of the final wording.

- **A (recommended). Applying starts a change on a branch, with the edited decisions `proposed`.**
  You approve the diff, as for any decision.
  - [pro] you read the final text, and the constitution's rule holds.
  - [con] one more step after answering.
- **B. Apply on the default branch as `active`, since your answer is the request.**
  - [pro] no extra step.
  - [con] a decision text you never read becomes binding.

**Answer:** A

## Q6: What happens to the existing 21 decisions?

They need the pass. Changing them all in one spec passes the
[split rule](/skills/uraeda/references/writing.md#a-spec), 2 changed decisions, and means reading
11,000 words in a sitting. The check of Q4's option A could produce the pass in batches.

Why it matters: a spec you cannot review in one sitting is not approved well.

- **A (recommended). This feature builds the rules, check, and page. Its first run of the check is
  the pass, as a follow-up feature or changes in batches.**
  - [pro] each batch is reviewable, and the new rules get tested on the real ledger.
  - [con] the ledger stays long for a while.
- **B. Rewrite all 21 in this feature.**
  - [pro] done at once.
  - [con] one huge approval.
- **C. Rewrite none: apply the bar when a decision is next touched.**
  - [pro] no work now.
  - [con] the ledger stays long indefinitely.

**Answer:** B

## Q7: Do you want a decision about UI coherence?

Your example: the same information presented the same way across pages, built from shared
components, unless there is an extremely good reason.
[UI components](/specs/decisions/ui-components.md) covers styling and component choice, not
presenting information. A decision is created only from your answer.

Why it matters: it would bind the redesign work in flight.

- **A (recommended). A new short decision, `ui-coherence.md`, of two or three rules, as the model of
  the new style.**
  - [pro] one home for the rule, short as you described.
  - [con] a second UI decision beside UI components.
- **B. One rule added to UI components.**
  - [pro] no new file.
  - [con] UI components then mixes styling and information.
- **C. No decision.**
  - [pro] nothing new to follow.
  - [con] the drift you dislike stays unchecked.

**Answer:** A

## Settled without the human

### Check these

- **The benchmark branch's decision** stays as that branch proposes it. The new bar applies to it
  when its spec is reviewed again, not here.

### Behaviour

- **The decisions page** draws each rule with the spec page's rule line, its strength icon and check
  line, from the same component. It is the proposal's explicit ask. See
  [discovery](discovery-01.md#needs-no-choice).

### Under the hood

- **Specifics removed from decisions** go nowhere new: the code, tests, and lint hold them.

**Notes:**
