---
kind: feature
finished: 2026-10-19
pull-request: https://github.com/mrtolkien/uraeda/pull/47
---

# Record: Decisions pass

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19, in [its pull request](https://github.com/mrtolkien/uraeda/pull/47). Its full files are
> in git: `git log -- specs/2026-10-19-decisions-pass/`.

## What and why

Decisions had drifted from the human's intent into specifications: flags, timeouts, and file names
that the code and its checks already hold, so reviewing them took long and little of it was a
choice. The feature gives decisions a written bar, rewrites the ledger to it, draws a decision's
rules as the spec page does, and adds a "Check decisions" run that finds decisions competing with
each other.

## Behaviour

- **A decision states intent, not mechanism.** The skill's test for a decision has a fourth
  question: is this the human's goal or approach, or a value the code holds? A flag, a timeout, or a
  file is the code's, unless the human states it as a hard value, which stays and links their
  answer. `ura check` measures nothing beyond its 10-rule warning. A test fails when a rule names a
  flag, a time in seconds or minutes, or a backticked file that its own checks do not name.
- **The ledger was rewritten to the bar**, all 21 decisions at once, from 11,152 to about 8,800
  words, comparing each with the answers of the records it links. Rules dropped that a record shows
  the human asked for are listed in the pull request.
- **The decisions page draws rules as the spec page does**: a strength icon, the words, and the
  check on a muted line, from the spec page's component, fed by the core's comparison of the
  decision with itself.
- **UI coherence** is a new decision: one shared component draws the same information on every page.
- **Check decisions** starts an agent that reads the constitution and every decision and writes
  `specs/DECISIONS-CHECK.md`: each finding offers two or three options, each shown as the edited
  decision against the active one, from `specs/decisions-check/q<N>-<letter>/`. It is answered in
  the questions view and applied by starting a change whose branch holds the edits as `proposed`.
  The button is disabled while a check waits. No option edits the constitution. A follow-up
  question's options edit no decision.

## Design

The triage's code became generic over a `DefaultRound`, `Triage` or `DecisionsCheck`, which owns
each file's path, id, and commit subjects: the same reader, hash check, submit, and views serve
both, from the core to the web. The core also reads the check's candidates and compares each with
the active decision, sending them on the file's view.

- [`DefaultRound`](/crates/core/src/actions/default_round.rs) and
  [its API](/crates/core/src/api/answers/default_round.rs)
- [`candidates`](/crates/core/src/decisions/candidates.rs): the reader, and what counts as a
  candidate file
- [the rules of a decision](/crates/core/src/api/ledger.rs) and
  [their view](/packages/web/src/decisions/DecisionRules.tsx)
- [the check page](/packages/web/src/decisions/CheckPage.tsx),
  [its banner](/packages/web/src/decisions/DecisionsCheckBanner.tsx), and
  [the candidate cards](/packages/web/src/decisions/Candidates.tsx)
- [the server's messages and ids](/packages/server/src/runner/round-messages.ts)
- [the check's reference](/skills/uraeda/references/decisions-check.md), with its template and
  example

## Questions

### Round 01

#### Q1: What makes something a decision?

**Answer:** A: a fourth test, "intent, not mechanism", with examples, in the skill's one definition.

#### Q2: How is a decision's length limited?

**Answer:** C: measure nothing: "It's the failure of the last pass but we're changing how it works",
and review the existing decisions against the records.

#### Q3: How does the coherence check run?

**Answer:** A: a questions file like the triage, sharing its code, and "re-use the decision diff
view we use for specs".

#### Q4: What does the check look for?

**Answer:** A: conflicts, overlaps, and decisions that fail the bar.

#### Q5: Where do the check's answers land?

**Answer:** A: applying starts a change, with the edited decisions `proposed`.

#### Q6: What happens to the existing 21 decisions?

**Answer:** B: rewrite all 21 in this feature.

#### Q7: Do you want a decision about UI coherence?

**Answer:** A: a new short decision, `ui-coherence.md`.

#### Settled without the human

##### Check these

- The benchmark branch's decision stays as that branch proposes it; the new bar applies when its
  spec is reviewed again.

## Decisions

- New: [UI coherence](../decisions/ui-coherence.md).
- Changed, rewritten to the bar: every other decision of [the ledger](../decisions/), 21 in all.

## Changes after approval

- A second check is refused only by the page's disabled button, as the triage's is, and by no
  function of the core.
- The bar's test ignores durations in days, so a lifetime the human chose, like a session's 30 days,
  stays.
- A decision's rule drawn on the decisions page lost the links of its words.

## Follow-ups

- Rules drawn on the decisions page lose the links of their text, and `ura check` on one candidate
  file skips the candidate name rules.
- A check's stale-option skip ignores decisions proposed on open branches, and `/decisions/check`
  shadows a decision named `check`.
- Reading the ledger reads every candidate of a waiting check, and an inbox edit refetches it.
- An option that removes a decision is drawn with no candidate card.
