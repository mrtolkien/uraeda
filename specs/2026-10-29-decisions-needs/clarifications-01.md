---
status: awaiting-human
---

# Clarifications, round 01: Decisions understandable with no context

> [!IMPORTANT]
>
> 5 questions and 1 follow-up, about 20 minutes.
>
> - Verdict: worth building, with changes: the skill already asks for intent and a short history,
>   but nothing measures it. The ledger grew 45% in the ten days since the last rewrite.
> - Two choices last beyond this feature: the test that makes a rule specific enough for you to
>   validate, and what a **Why** holds.
> - Whether to measure decisions in `ura check` goes back on your answer to the decisions pass,
>   "measure nothing".
> - The rewrite of all 27 decisions, and merging four overlapping pairs, decide the size of your
>   spec review.
> - Two points are settled without you: check them before the questions.

## Context

### Goal

The [proposal](proposal.md) asks for decisions that an agent understands from the file alone. You
validate them rule by rule, and their **Why** holds only what is useful. It covers both the 27
decisions of [the ledger](/specs/decisions/) and the skill's guidelines for writing them.

### Today

A decision has an intent of two or three sentences, up to 10 rules, then **Why**, **Alternatives
considered**, **Consequences**, **Applies to**, and **Revisit when**
([the template](/skills/uraeda/assets/templates/specs/decisions/decision-topic.md)). The skill
already says a decision states intent, not mechanism, and that its history stays in the record.

The ledger does not follow it. Measured in this session:

| Measure                                     | Ledger today    | The skill's example |
| ------------------------------------------- | --------------- | ------------------- |
| Words per decision, on average              | about 500       | about 290           |
| Longest **Why**                             | 401 (UI layout) | 69                  |
| Rules holding two or more MUST, SHOULD, MAY | 57 of 178       | 4 of 30             |
| Links to records of finished features       | 83              | links to its round  |

A link to a record leads to the question's answer in one line, not to its reasoning. Detail enters
when a decision is edited to describe the code. The commit "the UI decisions say what the code does"
added a stylesheet exception for "the closed rail's `SideNavItem` rows" to
[UI components](/specs/decisions/ui-components.md).

### Scope

The skill's guidelines, template, and example for decisions, `ura check`'s rules on them, and the
ledger's text. Left out: how agents find the decisions that apply to them, and loading decisions
into an agent's prompt.

### Sources

- Every decision of the ledger, the skill's references on decisions, the bar's test, and
  `ura check`'s decision rules.
- Decision record formats: Nygard's, MADR, Y-statements, Zimmermann's anti-patterns, and the
  guidance of Microsoft, AWS, and Fowler.
- Guidance on agents' instructions: Claude Code's memory and best practices, Anthropic's prompting
  and context guidance, Cursor's and Copilot's rules, and Spec Kit.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **Terms are defined in the decision** that uses them, in a few words at their first use. For
  example: "fate, the server's data protocol". This is the skill's
  [writing rule 3](/skills/uraeda/references/writing.md#every-document), which decisions already
  fall under and break. No glossary file is added. See
  [discovery](discovery-01.md#what-a-reader-with-no-context-meets).
- **Rules the rewrite drops are listed in the spec**, each with the decision it leaves and where its
  detail goes. Your approval then covers every removal. See
  [discovery](discovery-01.md#how-the-detail-got-in).

## Q1: Does this feature rewrite all 27 decisions, or only the guidelines?

The [decisions pass](/specs/done/2026-10-19-decisions-pass.md) rewrote the ledger ten days ago, when
you picked "rewrite all 21 in this feature". It has grown since, from 9,441 words to 13,658, with
four new decisions. Guidelines alone change no decision until a feature edits it. More in
[discovery](discovery-01.md#scope-of-the-rewrite).

Why it matters: it decides whether the ledger is fixed when this feature merges, and how much you
review in its spec.

- **A (recommended). Change the guidelines, then rewrite every decision of the ledger to them in
  this feature. The spec shows each as a diff against today's text.**
  - [pro] the guidelines are tested on 27 real cases before you approve them.
  - [con] the spec review holds 27 diffs, though each is shorter than the text it replaces.
  - Why recommended: you see the guidelines' effect on decisions you know, and the ledger is fixed
    in one review.
- **B. Change the guidelines here, then rewrite the ledger through a decisions check after the
  merge.**
  - [pro] a smaller spec, about the guidelines only.
  - [con] a second round for you, and the ledger stays as it is until then.
- **C. Change the guidelines only; each decision follows them when a feature next edits it.**
  - [pro] almost nothing to review now.
  - [con] decisions no feature touches keep their history and detail for good.

**Answer:**

### Q1.A: Does the rewrite also merge the decisions that overlap?

Only if you picked A in Q1. Four pairs say the same thing in two places:

- [Testing](/specs/decisions/testing.md) and [UI checks](/specs/decisions/ui-checks.md): UI tests
  are rare, and you review the UI by using it.
- [UI coherence](/specs/decisions/ui-coherence.md) and
  [UI components](/specs/decisions/ui-components.md): which component draws what.
- [Stack](/specs/decisions/stack.md) and [Sign-in](/specs/decisions/sign-in.md): which requests and
  preview frames the server accepts.
- [Keyboard](/specs/decisions/keyboard.md) and [UI behaviour](/specs/decisions/ui-behaviour.md):
  every action by keyboard and by tap, never by hover or a key alone.

More in [discovery](discovery-01.md#overlaps-between-decisions).

Why it matters: an agent reading one decision of a pair misses the other half of the rule.

- **A (recommended). Merge each pair in the rewrite. UI checks joins Testing, UI coherence joins UI
  components, and Stack's request rules join Sign-in. The shared keyboard rule stays in Keyboard
  only.**
  - [pro] each rule has one home, and the ledger drops to 25 files.
  - [con] the spec lists two removed decisions, and links to them change.
  - Why recommended: a rewrite is the cheapest moment, and the merges are the same work as the
    rewrite.
- **B. Rewrite each decision alone, and leave the merges to a later decisions check.**
  - [pro] each diff compares one decision with itself.
  - [con] the overlaps stay, and need a round of their own.

**Answer:**

## Q2: How specific may a decision's rule be?

Example: [UI components](/specs/decisions/ui-components.md) holds this rule:

> A stylesheet MAY stand in, with its reason in a comment, only for the closed rail's `SideNavItem`
> rows, whose width, centring, and label no prop reaches. Its consequences name `ToolGroups.tsx`,
> `useFontStyle`, and the class `.astryx-side-nav-item`.

The skill already refuses mechanisms, a flag, a timeout, or a file name, unless you chose the value.
The example passes that test, yet you cannot validate it without opening the code. Most detail came
in when decisions were edited to describe the code after the UI work. Established formats send this
detail elsewhere: "Move the detail design to a separate document" (Zimmermann), and "Avoid making
decision records design guides" (Microsoft). Claude Code's guidance adds that an agent should be
told only what it cannot find by reading the repository. More in
[discovery](discovery-01.md#how-specific-a-rule-may-be).

Why it matters: this test decides what every future decision may say, and how long your review of
each takes.

- **A (recommended). Add a fifth test to what a decision is: you can judge each of its lines from
  your goals, without opening the code. Names of components, hooks, files, CSS classes, and lists of
  fields or keys stay in the code, its comments, its tests, or the UI guides.**
  - Example: the rule becomes "A plain stylesheet or inline style MAY stand in where the design
    system cannot reach, with its reason in a comment." The rail's rows are one such comment, in the
    code.
  - [pro] every line of a decision is one you can approve or refuse; agents find the specifics in
    the code they are editing.
  - [con] a value you chose once in a round, like the base keymap's keys, moves to a UI guide. You
    do not approve a guide line by line.
  - Why recommended: it is the proposal's own complaint turned into a test, and every source agrees
    on it.
- **B. Keep rules at the level of intent, and allow code detail only in Consequences and Applies
  to.**
  - Example: the rule reads as in A, and the rail's rows stay named under Consequences.
  - [pro] agents keep a map of the exceptions in the decision.
  - [con] you still approve lines you cannot validate, and these two sections are where detail grew.
- **C. Keep today's four tests, and apply them more strictly in the rewrite.**
  - Example: the rule may stay, since you approved the rail's exception.
  - [pro] no change to the skill.
  - [con] the test that let this detail in stays as it is.

**Answer:**

## Q3: What does a decision's Why hold?

Example: [Compatibility](/specs/decisions/compatibility.md)'s **Why** reads today:

> You asked not to keep backward compatibility before version 1.0, and to write it down as a
> decision, when the clarifications redesign changed the round's format (the Notes of round 01).
> Reviewing the spec, you added that an agent meeting a file that fails `ura check` fixes it anyway
> (C1 of the spec's review). Uraeda is a proof of concept whose formats still move [...]

The reason is the last sentence.

Thirteen decisions tell who asked what and when. 83 links point to records of finished features. A
record keeps each answer in one line, so the link adds less than the decision says. Every source
keeps a brief reason: it lets a reader tell whether the decision still holds. Anthropic's guidance
adds that it lets a model apply a rule to cases it does not name. More in
[discovery](discovery-01.md#what-a-why-holds).

Why it matters: the **Why** is what an agent uses to apply a rule to a case the rule does not name.

- **A (recommended). The Why states the reason itself, in the present tense, in a few sentences: the
  problem and what the choice protects. It tells no history and cites no question number. It quotes
  you only when your words are the reason, and ends with at most one link to the record.**
  - Example: "Uraeda's formats still change feature after feature. Code reading old formats would
    grow with each change, for files that live a few days on a branch. History:
    [Redesign clarifications](/specs/done/2026-10-17-redesign-clarifications.md)."
  - [pro] an agent reads the whole reason in the file; you can still trace it in one click.
  - [con] the link to each question's answer is gone, keeping only the record's.
  - Why recommended: it keeps the reason the sources call essential, and the history the proposal
    calls noise stays one click away.
- **B. The same, with no link to records at all.**
  - Example: the same two sentences, with no history link.
  - [pro] nothing points an agent away from the file.
  - [con] tracing a decision back to your answer takes `git log`.
- **C. No Why section: the intent paragraph holds the reason.**
  - Example: Compatibility's intent gains the clause "since formats still change feature after
    feature".
  - [pro] the shortest decisions.
  - [con] costs and reasons share three sentences, and some reasons will not fit.

**Answer:**

## Q4: What do Alternatives considered and Consequences keep?

Example: [UI layout](/specs/decisions/ui-layout.md) lists 9 alternatives, among them "Justified
paragraphs: rivers on the phone's narrow lines" and "CSS `zoom` on desktop: it breaks dragging's
position math". [UI components](/specs/decisions/ui-components.md)'s consequences say how fonts
reach the phone's row bar.

The skill asks for every reversed choice under **Alternatives considered**, "so no agent proposes it
again", and nothing ever removes one. Most formats keep honest costs and the serious alternatives,
and MADR marks both sections optional. More in
[discovery](discovery-01.md#which-sections-a-decision-keeps).

Why it matters: these two sections are where history and code detail accumulate, edit after edit.

- **A (recommended). Keep both sections. Alternatives list only options an agent could propose again
  today, at most 3, one line each with why they lose. Consequences list only costs you accepted and
  what a future feature must do, at most 4, with no code facts.**
  - Example: UI layout keeps "Two width classes: half a screen got the desktop's layout, and broke",
    and drops the justified paragraphs and CSS zoom.
  - [pro] agents keep the guard against re-proposals, without the history.
  - [con] a dropped alternative may be proposed again; its record still says why it lost.
  - Why recommended: it keeps the two sections' purpose and caps what made them grow.
- **B. Remove both sections from the template: the Why names the costs and the close alternative in
  a sentence each.**
  - Example: UI layout's Why ends "Two width classes were tried, and broke at half a screen."
  - [pro] the shortest template, nearest to a Y-statement.
  - [con] a format change for every decision, the example, and the fixtures, and costs become easy
    to leave out.
- **C. Keep both sections as they are.**
  - [pro] nothing changes.
  - [con] they keep growing, as UI layout's did.

**Answer:**

## Q5: Does `ura check` measure a decision's length?

In the decisions pass you chose to measure nothing: "It's the failure of the last pass but we're
changing how it works". The ledger then grew by 45% in ten days. A Hacker News thread on agents'
decision records names the same drift, "They got longer and longer". Its fix is a token budget.
`ura check` warns today only past 10 rules, and on rules out of order. A warning never fails a
check. More in [discovery](discovery-01.md#measuring-the-limits).

Why it matters: without a measure, the next edits regrow what the rewrite cuts.

- **A (recommended). Warn per section: an intent past 3 sentences, or a Why past 80 words. Warn on
  more than 3 alternatives or 4 consequences, and on a rule holding two MUST, SHOULD, or MAY.**
  - Example: an edit adding a fourth alternative to UI layout shows a warning on the decision's page
    and in `ura check`.
  - [pro] each warning names the section to cut; 57 of today's rules would show the two-ideas one.
  - [con] five new rules in the core, and a rule written as two clauses on purpose warns too.
  - Why recommended: it measures each place the ledger grew, and warnings never block you.
- **B. Warn on one word budget per decision, 350 words.**
  - Example: UI layout, at 985 words, warns until it is under 350.
  - [pro] one rule, simple to read.
  - [con] it does not say what to cut, and a short decision may still hold a verbose Why.
- **C. Measure nothing, as decided in the decisions pass.**
  - [pro] no new rule.
  - [con] the review is the only guard, which held for ten days last time.

**Answer:**

## Settled without the human

### Under the hood

- **The bar's test stays**, [`decisions_bar.rs`](/crates/core/tests/decisions_bar.rs), which fails
  on a flag, a time, or a file name in a rule. It catches mechanisms a warning would let through.
- **The decisions check follows the new bar**: it holds decisions to
  [what is a decision](/skills/uraeda/references/spec.md#what-is-a-decision). A rule that fails the
  new test becomes one of its findings, with no change to the check's own steps.
- **The example's decisions are rewritten only where they break a new rule.** They are already close
  to the target, at about 290 words each.

**Notes:**
