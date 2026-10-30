---
status: auto-approved
spec-revision: 2
---

# Plan: Decisions understandable with no context

**Goal:** The skill's guidelines hold a decision to a fifth test and a short, self-contained shape,
`ura check` warns where a decision regrows, and the example and the repository's links follow the
rewritten ledger.

**Architecture:** The ledger's 25 decisions are already rewritten and active on this branch: no task
edits `specs/decisions/`. Each rule keeps one home, as the
[spec's architecture](spec.md#architecture) says. The bar, what a decision may say, lives in the
spec reference's [what is a decision](/skills/uraeda/references/spec.md#what-is-a-decision). The
shape and its numbers live in the writing reference's
[a decision](/skills/uraeda/references/writing.md#a-decision), and every other mention links there.
`ura check` measures the numbers in one place, [`decision.rs`](/crates/core/src/check/decision.rs),
with one constant per limit beside `DECISION_RULES`. A rule's keywords are read by the parser that
already reads its strength, [`strength.rs`](/crates/core/src/decisions/strength.rs), so the order
and the count never disagree on what a keyword is.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A keyword the rule only mentions.** A rule naming `MUST` in inline code, or a check reading
   "Checked by a lint that refuses MAY", holds one keyword: only the rule's words before "Checked
   by", outside code, count. Task 2.
2. **A Why whose length is mostly link targets.** A Why of 60 words with long record paths stays
   silent: a link's text counts, its target does not. Task 2.
3. **Warnings never change the outcome.** A decision breaking every limit still checks with only
   warnings, so `ura check` exits with success. Task 2.

## Global constraints

From the [spec](spec.md#architecture), word for word:

- The writing rules "own the shape and its numbers: an intent of 3 sentences at most, one keyword
  per rule, a Why of 80 words at most, at most 3 alternatives and 4 consequences, terms defined at
  their first use, and Applies to naming folders and kinds of features."
- They "own how a Why reads: the reason in the present tense, no history, quotes only when your
  words are the reason, at most one link to the record."
- The bar "gains a fifth test: you can judge each line of a decision from your goals, without
  opening the code. Names of components, hooks, functions, CSS classes, and files inside a folder,
  and lists of fields or keys, stay in the code, its comments and tests, or the project's guides. A
  value stays when you chose it and would check a plan against it."
- "A decision is never edited to describe the code, unless you ask: when the code and a decision
  disagree, the code changes, or the question comes to you. The skill's spec reference says so."
- "Sentences and words are counted as `writing.sentence` reads text: an intent's sentence ends at
  `.`, `!`, or `?`, and inline code and link targets do not count."
- The edge cases: MUST NOT counts as one keyword; a keyword in inline code or after "Checked by"
  does not count; a Why's link text counts as words, its target does not; a candidate in
  `specs/decisions-check/` warns like any decision; a decision with no Why, alternatives, or
  consequences has nothing to measure.

From the decisions:

- [Problems](/specs/decisions/problems.md): the new rules are warnings, never problems.
- [CLI](/specs/decisions/cli.md): each new warning is written in the skill, with the CLI.
- [Compatibility](/specs/decisions/compatibility.md): the limits apply to every decision at once,
  with no fallback.
- [Code quality](/specs/decisions/code-quality.md): "Rust and TypeScript functions and files MUST
  stay within limits on length, parameters, and nesting. Checked by clippy and Oxlint." "A custom
  lint rule or structural test MUST say in its message how to fix the problem."

Preserved: `decision.rules` and `decision.order` keep their messages and lines, guarded by
`a_decision_of_12_rules`, `a_must_after_a_should`, and `each_rule`'s decision rows in
[`check.rs`](/crates/core/tests/check.rs).

## Code read

- [`decision.rs`](/crates/core/src/check/decision.rs): `check_decision` parses the file, finds the
  top-level `## Rules` heading, and warns `decision.rules` on it past `DECISION_RULES`, and
  `decision.order` on the first rule stronger than the one before. It runs on every file of
  `specs/decisions/` and on the candidates of `specs/decisions-check/`
  ([`check/mod.rs`](/crates/core/src/check/mod.rs), `Checked::Decision`).
- [`writing.rs`](/crates/core/src/check/writing.rs): `sentences` splits words at a word ending in
  `.`, `!`, or `?`, and `is_word` keeps tokens holding a letter or digit. Its `measured_text` drops
  link text, which the Why's count keeps: the decision checks need their own span text.
- [`strength.rs`](/crates/core/src/decisions/strength.rs): `strength` returns the first keyword of a
  text, MUST NOT read as one keyword.
- [`document.rs`](/crates/core/src/files/document.rs): `Span` carries `code`, `link`, and `image`,
  `Document::children` lists a block's children.
- [`check.rs`](/crates/core/tests/check.rs): `Example` copies the skill's example `specs/` to a
  temporary folder; `with_rules` replaces a decision's rules; `the_example_has_no_problems` asserts
  no problem nor warning on the example. `every_decision_of_the_repository_holds_at_most_10_rules`
  reads the deleted `ui-checks.md`, so it panics on this branch until task 2 rewrites it.
- [The example's decisions](/skills/uraeda/assets/example/specs/decisions/): measured with a script
  in this session. Code quality, Preview, Repeating tasks, and Testing hold rules with two keywords;
  Due dates and Repeating tasks link more than once from their Why. Nothing else breaks a new limit.
- [The ledger](/specs/decisions/): measured the same way, 10,642 words, no section past a limit, one
  record link per Why.
- Links to `ui-checks.md` and `ui-coherence.md`: two UI guides, nine records of `specs/done/`, the
  coherence-pass change's rulings. Code comments and lint messages name "the UI checks decision" or
  "UI coherence" in `vite.config.ts` and seven files of `packages/web/`. The fixtures and stories
  keep them: they are test data of their time.
- Validation: `nix develop -c cargo nextest run -p uraeda-core`, `nix develop -c cargo clippy`,
  `vp check`, and `ura check` over `specs/`.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Complexity tracking

None.

## Test map

The tests run the core's `check::check` over a copy of the skill's example, or over the repository
itself, with no clock and no git. Two new tests: one for the five warnings, US2's three key
scenarios and their rows, and the repository's ledger test, rewritten, for US3 1 and the success
criteria.

| Spec                                                                    | Task | Test                                                                                                       |
| ----------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------- |
| US1 1, 2, 3, more 1, 2, 3                                               | none | none: the skill's text, read in review; the ledger already shows each one                                  |
| US2 1, 2, 3, more 1, 2; SC-003                                          | 2    | `check.rs`, `each_decision_limit`: one row per warning one past its limit, its message and line            |
| SC-003, at the limit                                                    | 2    | `each_decision_limit`: the same decision at each limit warns nothing                                       |
| US2 more 3; Review focus: warnings never change the outcome             | 2    | `each_decision_limit`: every row's problem is a warning                                                    |
| Edge: MUST NOT; a keyword in code or after "Checked by"; Review focus 1 | 2    | `each_decision_limit`: a row whose rule holds all three, with no warning                                   |
| Edge: a Why's links; Review focus 2                                     | 2    | `each_decision_limit`: the Why at 80 words plus a long link target, silent                                 |
| Edge: no Why, alternatives, or consequences                             | 2    | `the_example_has_no_problems`: the example's Code quality and Testing have no alternatives                 |
| Edge: a candidate in `specs/decisions-check/`                           | none | none: candidates already run `check_decision`, as `Checked::Decision` routes them                          |
| Edge: a project's decision past a limit; a branch in flight             | none | none: a warning, as every other row shows; a rebase is git's                                               |
| US3 1; SC-001; SC-002; SC-004                                           | 2    | `check.rs`, `the_ledger_reads_alone`: no `decision.*` warning, at most 11,000 words, one record link a Why |
| US3 2, 3                                                                | none | none: the ledger's text, approved with the spec                                                            |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Tasks 1, 3, and 4: the example's decisions, the skill's references and template, and the links to
   the removed decisions. No file in common.
2. Task 2: the warnings, which need the example's decisions clean for `the_example_has_no_problems`.

---

## Task 1: The example's decisions follow the new rules

**Files:**

- Modify: `skills/uraeda/assets/example/specs/decisions/code-quality.md`, `preview.md`,
  `repeating-tasks.md`, `testing.md`, `due-dates.md`; the decisions it quotes in
  `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/plan.md`; the setup templates
  `skills/uraeda/assets/templates/specs/decisions/preview.md` and `testing.md` (ruling R1)

**Interfaces:**

- Produces: an example whose decisions hold one keyword per rule, and one link in each Why.

- [x] **Step 1: Split each rule holding two keywords into rules of one**

Code quality's marker rule, Preview's command, wrapper, and version rules, Repeating tasks' move
rule, and Testing's replaced-behaviour rule each become rules of one keyword, strongest first, at
most 10 per decision. Preview's first rule keeps its command in code: the
[preview tests](/crates/core/tests/check.rs) read it.

- [x] **Step 2: Rewrite Due dates' and Repeating tasks' Why**

The reason in the present tense, no "the human chose", the human's words quoted only where they are
the reason, and one link to the feature's record at most.

- [x] **Step 3: Run the task's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-core -E 'test(the_example) | test(preview)'`
- Expected: PASS

- [x] **Step 4: Commit**

```bash
git add skills/uraeda/assets
git commit -m "docs(decisions-needs): the example's decisions hold one keyword per rule"
```

## Task 2: `ura check` warns where a decision regrows

**Files:**

- Modify: `crates/core/src/check/decision.rs`, `crates/core/src/check/mod.rs` (its `pub use`),
  `crates/core/src/check/writing.rs` (`sentences`, made `pub(super)`),
  `crates/core/src/decisions/strength.rs`
- Modify: `skills/uraeda/assets/example/specs/decisions-check/q1-a/code-quality.md`, the example
  check's candidate, whose marker rule holds two keywords (ruling R1)
- Test: `crates/core/tests/check.rs`

**Interfaces:**

- Consumes: task 1's example.
- Produces: the warnings `decision.intent`, `decision.why`, `decision.alternatives`,
  `decision.consequences`, and `decision.keywords`; the constants `DECISION_INTENT_SENTENCES = 3`,
  `DECISION_WHY_WORDS = 80`, `DECISION_ALTERNATIVES = 3`, `DECISION_CONSEQUENCES = 4`, exported from
  `check` beside `DECISION_RULES`; `decisions::keywords(text: &str) -> usize`, the number of
  keywords in a text, read as `strength` reads the first.

- [x] **Step 1: Write the failing tests**

`each_decision_limit`, a table over `Example`'s Task storage decision, each row a break and the
warning it gives, asserted with `summary(...).contains`, and the problem's rule and severity:

- 4 sentences of intent: `decision.intent` on the title's line, "4 sentences: keep the intent to at
  most 3".
- A Why of 81 words: `decision.why` on `## Why`, "81 words: keep the reason under 80".
- 4 alternatives: `decision.alternatives` on its heading, "4 alternatives: keep at most 3, the ones
  an agent could propose again".
- 5 consequences: `decision.consequences` on its heading, "5 consequences: keep at most 4, the costs
  and what a later feature must do".
- The rule "Sessions MUST be random, and MUST end after 30 days." on its line: `decision.keywords`,
  "2 keywords: one rule holds one MUST, SHOULD, or MAY".

Then one decision at every limit, with a rule "Code MUST NOT call `MAY` directly. Checked by a lint
that refuses SHOULD." and a Why of 80 words plus a link whose target is long: no warning.

`the_ledger_reads_alone` replaces `every_decision_of_the_repository_holds_at_most_10_rules`: over
the repository's `specs/decisions/`, no warning whose rule starts with `decision.`; the 25 files
hold at most 11,000 words, their frontmatter aside; no Why links more than one file of
`specs/done/`.

The break each test catches:

- `each_decision_limit`: a limit off by one, a warning on the wrong line, a keyword counted in code
  or in the check, link targets counted as words, a warning raised as a problem.
- `the_ledger_reads_alone`: a decision edited past a limit, or its Why regrown with links.

- [x] **Step 2: Run them to check they fail**

- Run:
  `nix develop -c cargo nextest run -p uraeda-core -E 'test(each_decision_limit) | test(the_ledger_reads_alone)'`
- Expected: FAIL, the intent row: `warning: specs/decisions/task-storage.md:7: 4 sentences: ...` not
  in the problems.

- [x] **Step 3: Implement the five warnings in `decision.rs`**

`check_decision` reads each section once. The intent is the top-level paragraphs between the title
and the first level-2 heading; the Why, every paragraph and item under `## Why`; the alternatives
and consequences, the top-level items of their sections. Text is the spans' text, with code and
images left out and links kept as their text; sentences and words are counted with `writing`'s
`sentences` and `is_word`. A rule's keywords are counted on its text before "Checked by", code left
out, with `decisions::keywords`, which shares `strength`'s reading of a word. Each warning names the
count, the limit, and what to cut, as the messages above.

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-core`, then
  `nix develop -c cargo clippy --all-targets`
- Expected: PASS, no clippy warning.

- [x] **Step 5: Commit**

```bash
git add crates/core skills/uraeda/assets
git commit -m "feat(decisions-needs): ura check warns where a decision regrows"
```

## Task 3: The skill's guidelines for a decision

**Files:**

- Modify: `skills/uraeda/references/spec.md` (what is a decision, new decision or change, writing a
  decision, self-review, red flags), `skills/uraeda/references/writing.md` (its warning list, a
  decision), `skills/uraeda/references/cli.md` (its warning list),
  `skills/uraeda/references/decisions-check.md` (what counts as a finding),
  `skills/uraeda/assets/templates/specs/decisions/decision-topic.md`, and the Why of the setup
  template `testing.md`, which asked for links to the question and the discovery topic

**Interfaces:**

- Produces: the anchors `spec.md#what-is-a-decision` and `writing.md#a-decision`, unchanged.

- [x] **Step 1: Add the fifth test to what is a decision**

The test, as the global constraints quote it. The fourth test's last sentence becomes "A rule keeps
a value only when the human chose that value", without its link. The example "a session lasts 30
days" keeps the value, and its Why gives the reason. Add: a decision is never edited to describe the
code, unless the human asks.

- [x] **Step 2: Move the shape to the writing reference**

`a decision` in the writing reference gains the numbers and how a Why reads, each with its warning;
the history rule becomes the Why's. Writing a decision in the spec reference keeps what each section
is for, and links the writing reference for the numbers rather than restating them. New decision or
change: a reversed choice joins the alternatives, and the one an agent is least likely to propose
again goes past 3.

- [x] **Step 3: Update the template, the warning lists, the decisions check, and the red flags**

The template's placeholders say the limits. Both warning lists name the five new warnings. The
decisions check's finding names the fifth test and a warning `ura check` reports. A red flag: "The
decision should describe what the code does".

- [x] **Step 4: Run the task's validation**

- Run: `nix develop -c cargo nextest run -p uraeda-core`, and `vp check`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add skills/uraeda
git commit -m "docs(decisions-needs): a decision reads alone, judged from the human's goals"
```

## Task 4: Links to the removed decisions

**Files:**

- Modify: `specs/ui/README.md`, `specs/ui/components.md`, the nine records of `specs/done/` that
  link `ui-checks.md` or `ui-coherence.md`, `specs/changes/2026-10-26-coherence-pass/rulings.md`,
  `vite.config.ts`, and the code comments of `packages/web/` that name the two decisions

**Interfaces:**

- Produces: no link nor comment in the repository naming UI checks or UI coherence as a decision,
  outside `fixtures/`, stories' sample data, the changelog, and this feature's rounds.

- [ ] **Step 1: Point each link and comment to the decision that took the rule**

UI checks becomes [Testing](/specs/decisions/testing.md), UI coherence becomes
[UI components](/specs/decisions/ui-components.md). A list naming both a removed decision and its
heir keeps the heir once.

- [ ] **Step 2: Run the task's validation**

- Run: `ura check specs`, and `vp check`
- Expected: no problem but the five links of this feature's discovery and questions to the removed
  files. The spec keeps its rounds as written, and the record replaces them at the finish.

- [ ] **Step 3: Commit**

```bash
git add specs/ui specs/done specs/changes vite.config.ts packages/web
git commit -m "docs(decisions-needs): links to UI checks and UI coherence point to their heirs"
```
