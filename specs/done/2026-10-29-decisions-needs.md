---
kind: feature
finished: 2026-10-30
pull-request: https://github.com/mrtolkien/uraeda/pull/69
supersedes: [2026-10-17-redesign-specs, 2026-10-19-decisions-pass]
---

# Record: Decisions understandable with no context

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-29, finished on
> 2026-10-30, in [its pull request](https://github.com/mrtolkien/uraeda/pull/69). Its full files are
> in git: `git log -- specs/2026-10-29-decisions-needs/`.

## What and why

Agents often read a decision alone, before a task, without the record of the feature that made it.
The human found decisions too specific to validate, and their **Why** verbose. The ledger had grown
by 45% in the ten days since the last decisions pass, from 9,441 words to 13,658. This feature makes
each decision readable on its own and checkable rule by rule, measures where it regrows, and
rewrites the ledger to the new rules.

## Behaviour

- **An agent writes a decision that reads alone.** Every line passes a fifth test: the human judges
  it from their goals, without opening the code. Names of components, hooks, functions, CSS classes,
  files inside a folder, and lists of fields or keys stay in the code, its comments and tests, or
  the project's guides. A value stays when the human chose it and would check a plan against it. A
  decision is never edited to describe the code, unless the human asks.
- **The shape has numbers.** An intent of 3 sentences at most, one keyword per rule, at most 10
  rules, a Why of 80 words at most, at most 3 alternatives and 4 consequences, terms defined at
  their first use, and Applies to naming folders and kinds of features.
- **A Why reads in the present tense.** It gives the reason, tells no history, cites no question or
  comment, quotes the human only when their words are the reason, and ends with at most one link: to
  the feature's spec while it is in flight, then to its record. A reversed choice joins the
  alternatives, and past 3 the one an agent is least likely to propose again goes.
- **`ura check` warns where a decision regrows**, and `ura lsp` shows it in editors:
  `decision.intent` on the title, `decision.why`, `decision.alternatives`, and
  `decision.consequences` on their headings, and `decision.keywords` on a rule's line. They are
  warnings, never problems, on every decision and every candidate of a decisions check. MUST NOT is
  one keyword; a keyword in inline code or after "Checked by" does not count; a link's text counts
  as Why words, its target does not; a heading inside a quote or an item does not end a section.
- **The ledger holds 25 decisions and about 10,600 words**, each within the limits and with one
  record link in its Why. UI checks joined Testing, UI coherence joined UI components, Stack's
  request and preview-frame rules joined Sign-in, and the shared keyboard rule lives in Keyboard
  only.

## Design

Each rule keeps one home. The bar, what a decision may say, is
[what is a decision](/skills/uraeda/references/spec.md#what-is-a-decision); the decisions check and
the red flags link to it. The shape and its numbers are
[a decision](/skills/uraeda/references/writing.md#a-decision) in Writing for the human, and
[writing a decision](/skills/uraeda/references/spec.md#writing-a-decision) links to it. The
[decision template](/skills/uraeda/assets/templates/specs/decisions/decision-topic.md), the
decisions check's candidate template, the Preview and Testing setup templates, and
[the example's decisions](/skills/uraeda/assets/example/specs/decisions/) follow the rules.

- [`decision.rs`](/crates/core/src/check/decision.rs) measures every limit, one constant per limit
  beside `DECISION_RULES`, all exported from `check`. Sentences and words are counted as
  `writing.sentence` counts them, with inline code and images left out and links read as their text.
- [`strength.rs`](/crates/core/src/decisions/strength.rs) reads a rule's keywords: `keywords` counts
  them with the same reading of a word as `strength`, which takes the first.
- Tests: `each_decision_limit` and `the_ledger_reads_alone` in
  [`check.rs`](/crates/core/tests/check.rs).
- Links and comments naming the two removed decisions, in the records, the UI guides, the
  coherence-pass change, `vite.config.ts`, and `packages/web/`, point to the decisions that took
  their rules.

## Replaced behaviour

- **The ledger held UI checks and UI coherence, and 18 rewritten decisions stayed under 9,500
  words.** Guarded by `every_decision_of_the_repository_holds_at_most_10_rules` in
  [`check.rs`](/crates/core/tests/check.rs), replaced by `the_ledger_reads_alone`: no shape warning,
  at most 11,000 words over the whole ledger, one record link per Why.
- **A decision's Why linked the question and the discovery topic.** Guarded by no test.
- **Every reversed choice stayed under Alternatives considered.** Guarded by no test.
- **`ura check` measured nothing beyond the 10-rule warning and the rules' order**, as the decisions
  pass chose. Guarded by no test.

## Gotchas

- `check/mod.rs` sits at the 500-line limit of the structure test, so the limits are exported with
  one `pub use decision::*;`: every `pub` item of
  [`decision.rs`](/crates/core/src/check/decision.rs) is a limit.
- `decision.order` still reads a rule's first keyword from its plain text, inline code included,
  while `decision.keywords` leaves code out: preserved as it was.

## Questions

### Round 01

#### Q1: Does this feature rewrite all 27 decisions, or only the guidelines?

**Answer:** A: change the guidelines, then rewrite every decision to them in this feature, each
shown as a diff.

#### Q1.A: Does the rewrite also merge the decisions that overlap?

**Answer:** A: UI checks joins Testing, UI coherence joins UI components, Stack's request rules join
Sign-in, and the shared keyboard rule stays in Keyboard only.

#### Q2: How specific may a decision's rule be?

**Answer:** A: a fifth test, the human judges each line from their goals without opening the code;
names and lists stay in the code, its comments, its tests, or the UI guides.

#### Q3: What does a decision's Why hold?

**Answer:** A: the reason itself, in the present tense, in a few sentences, with no history and at
most one link to the record.

#### Q4: What do Alternatives considered and Consequences keep?

**Answer:** A: both sections stay, at most 3 alternatives an agent could propose again and 4
consequences, with no code facts.

#### Q5: Does `ura check` measure a decision's length?

**Answer:** A: warnings per section, and on a rule holding two keywords.

## Decisions

- Changed, rewritten to the new rules: all 25 decisions of [the ledger](../decisions/).
- Removed: UI checks (`ui-checks.md`), its rules in [Testing](../decisions/testing.md), and UI
  coherence (`ui-coherence.md`), its rules in [UI components](../decisions/ui-components.md).
- [Git](../decisions/git.md): reading a branch's step from its latest commit became a SHOULD.

## Changes after approval

- The spec's second revision, asked in its review: Git reads a branch's step from its latest commit
  as a SHOULD, so step detection may read files on disk when git is too slow.
- Beyond the rules the spec named, the example's Code quality, Preview, Due dates, Task storage, and
  UI components decisions, the decisions check's example candidate, and the Preview and Testing
  setup templates were rewritten to the new limits and the fifth test, so neither the example nor a
  newly set-up project warns.
- A comment citing UI checks' old "no text cut", which no decision held any more, keeps its reason
  without the citation.
