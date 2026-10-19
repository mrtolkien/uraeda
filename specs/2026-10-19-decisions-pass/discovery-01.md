# Discovery, round 01: Decisions pass

## Summary

The decision ledger holds the human's standing intent, but its 21 files, 11,152 words in all, read
as specifications. They carry numbers, flags, and mechanisms the code or a test already holds, so
review takes a long time and little of it is a choice. The skill already says "Specifics appear only
where they are hard constraints", and still the rewrite of
[Spec redesign](../done/2026-10-17-redesign-specs.md) left decisions at the 10-rule cap, and new
proposals came back as specific as before. The proposal asks for three things: a command that checks
the constitution and the decisions against each other, a higher bar for what a decision is, and a
decisions page that draws rules as the spec page does. Established practice (architecture decision
records) agrees with the higher bar: it records only significant decisions, briefly.

## How other products do it

### Architecture decision records

- An ADR captures one "architecturally significant" decision, a design choice with a measurable
  effect on the system's architecture and quality ([adr.github.io](https://adr.github.io/)). Read in
  full.
- Nygard, who named the practice, records decisions "that affect the structure, non-functional
  characteristics, dependencies, interfaces, or construction techniques", keeps each to one or two
  pages, and marks a reversed decision as superseded rather than editing it
  ([Documenting architecture decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).
  Read in full. Uraeda edits in place instead, because its ledger is the current state.

### What they have in common

- A size test: significance, not detail. Nothing in either source tells how to detect a conflict
  between two records; that is left to the reader. The coherence check below has no standard to
  copy, and no source was found that does it.

## Standards and libraries

None apply: the rules are workflow text, and the check reads files the core already parses.

## The code

### Important reads

- [`spec.md`, "What is a decision"](/skills/uraeda/references/spec.md#what-is-a-decision): three
  tests (an agent would not guess it, it outlives the feature, getting it wrong is costly). Nothing
  in them excludes a specific that passes all three, such as a flag an agent would not guess.
- [`spec.md`, "Writing a decision"](/skills/uraeda/references/spec.md#writing-a-decision) and
  [`writing.md`, rules 33 to 37](/skills/uraeda/references/writing.md#a-decision): intent first, one
  sentence per rule, at most 10 rules. "Specifics appear only where they are hard constraints" is
  the only limit on specifics, and it has no measure.
- [`crates/core/src/check/decision.rs`](/crates/core/src/check/decision.rs): `ura check` warns on
  `decision.rules` (over 10) and `decision.order` only. No length measure.
- The ledger's size: `wc -w specs/decisions/*.md` gives 11,152 words, the largest
  [stack](/specs/decisions/stack.md) with 760, and 18 of 21 files at 7 to 10 rules. Run in this
  session.
- Rules that read as code, from this session's reading of the files: `--permission-mode auto`, a
  10-second gap between SIGINT and SIGTERM and a 15-minute idle close in
  [agents](/specs/decisions/agents.md); a 768 px breakpoint, 17 px and 19 px body text in
  [UI layout](/specs/decisions/ui-layout.md); the exact `Content-Security-Policy` value in
  [stack](/specs/decisions/stack.md).
- The benchmark branch's proposed decision, `benchmarks.md`, read with `git show` on
  `2026-10-19-benchmarks`: nine rules, among them what the simulated human may see and a SHOULD NOT
  on reading the task's upstream repository. It is the kind of proposal the human called too
  specific. It is not on the default branch.
- [Redesign specs record](/specs/done/2026-10-17-redesign-specs.md#q5-what-shape-does-a-decision-take):
  the human answered "rules naturally fewer if we focus on big picture and intent instead of
  specifics". The limit stayed 10. Judging by the ledger today, the intent was not reached.

### The proposal's path and existing actions

- The inbox triage is the model for the check: the skill's
  [triage](/skills/uraeda/references/inbox.md#the-triage) has the agent write questions into
  `specs/INBOX-TRIAGE.md`, the human answers them, and an agent applies the answers. Its parts: two
  chat messages in [`triage-messages.ts`](/packages/server/src/runner/triage-messages.ts), the web
  page [`InboxTriage.tsx`](/packages/web/src/InboxTriage.tsx), and core code reading and checking
  the file ([`api/answers/triage.rs`](/crates/core/src/api/answers/triage.rs), `check/`). A second
  file of the same shape means a second copy of each part unless they are shared.
- A decision changes only on a branch, `proposed` until the human approves
  ([spec.md](/skills/uraeda/references/spec.md#new-decision-or-change),
  [change.md](/skills/uraeda/references/change.md#decisions)). The triage works in the default
  checkout and needs no feature. A check whose answers edit decisions must reconcile the two.
- The decisions page, [`DecisionDetail.tsx`](/packages/web/src/decisions/DecisionDetail.tsx), draws
  a decision through `Blocks`, the generic document renderer. The spec page, through
  [`DecisionCard.tsx`](/packages/web/src/spec/DecisionCard.tsx) and
  [`RuleLine.tsx`](/packages/web/src/spec/RuleLine.tsx), draws each rule with a coloured strength
  icon, its words, and its check on a muted line. A grep for `strength`, `RuleLine` and `PartText`
  in `Blocks.tsx` and `decisions/` found nothing: the same rule looks different on the two pages.

### Rules and their owners

- "What is a decision": `spec.md`, with a short form in
  [`writing.md`](/skills/uraeda/references/writing.md#a-decision) and
  [`discovery.md`](/skills/uraeda/references/discovery.md#what-to-ask-and-what-to-settle). A new bar
  is written once in `spec.md`; the others link to it.
- Rule limits: `decision.rs` and the numbers in `writing.md`; a new limit changes both.
- How a rule is drawn: `RuleLine.tsx` alone, used by the spec page.

### Likely changes

- `spec.md`, `writing.md`, `discovery.md`, and the decision template: a stricter bar.
- `crates/core/src/check/decision.rs`: a new warning if a length limit is chosen.
- A new reference for the check, `SKILL.md`'s references list, `ura` docs if a command is added, and
  for a web button the server's messages and the UI page, under the options of the check's topic.
- `decisions/DecisionDetail.tsx`: draw rules with `RuleLine`, whichever options are chosen.
- The 21 decisions, under the options of the pass's topic.

## The proposal

### "Decisions should include higher-order information"

A test an agent can apply is missing. "Intent, not mechanism" is a judgement, and the three tests
already in the skill did not stop specifics. Option topics below choose between a stricter wording
and a measure.

### The check's output is not defined

"Raise if some of them are competing, and explain the options clearly" says what the human reads
(two options to keep it clean), not where the answers land or who edits the decisions.

### "UI coherence" as a decision

The proposal gives UI coherence as an example of a good decision, without saying whether to write
it. [UI components](/specs/decisions/ui-components.md) already says the UI "looks and behaves as one
product", but about styling and components, not about presenting the same information the same way.

## Worth it and feasibility

The work is mostly text: skill rules, one warning, one component swap. The check is the costly part
if it copies the triage's code. The evidence supports building all of it. The check has no external
behaviour to verify. No guard is relaxed.

## Approaches

### What makes a decision

Whether the skill's bar changes, and how. Builds on [the code's reads](#important-reads).

- **A fourth test, "intent, not mechanism", with examples.** A decision states a goal or an approach
  that binds other work. A value, a flag, a timeout, or a file path is the code's, unless the human
  states it as a hard constraint.
- **Only rewrite the ledger, change no rule.** The existing text is the fix.
- **Two tiers**: short decisions, and a linked detail file for hard constraints.

### Limits

Whether a length is measured. Today only the rule count (10) is. Options: keep 10, lower the count
(for example 6) and add a word limit as a `ura check` warning, or measure nothing.

### How the coherence check runs

- **Mirror the triage**: a file of questions, `specs/DECISIONS-CHECK.md`, written by an agent,
  answered by the human, applied by an agent, with a web button.
- **Skill only**: a reference describing the check, started by a chat message, no new file format,
  answers given in chat.
- **Mirror the triage, sharing its code**, so both files use one reader, one page, and one pair of
  messages.

### What the check covers

Conflicts only; conflicts and overlaps (two decisions with one rule); or those plus decisions that
fail the new bar, which makes the pass over existing decisions the check's first run.

### Where the check's answers land

Edited on the default branch as active, because the human's answer is their request; or edited on a
branch as `proposed`, for the human to approve in the diff, as every other decision change is.

### The pass over existing decisions

Rewrite all 21 in this feature; split it into a follow-up feature; or change none and apply the bar
only when a decision is next touched. The [split rule](/skills/uraeda/references/writing.md#a-spec)
proposes a split past 2 changed decisions.

### UI coherence

A new decision, a rule added to UI components, or none.

### Needs no choice

- **The decisions page draws rules like the spec page.** `RuleLine` exists and the proposal asks for
  it.
- **Where removed specifics go**: nowhere new; code, tests and checks hold them.

## Not checked

- No source found on detecting contradictions between a set of architecture decision records.
- The pages above were read through a fetch tool that summarises: their quotes are the summary's.
