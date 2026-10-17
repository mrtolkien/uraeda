---
status: auto-approved
spec-revision: 2
---

# Plan: Redesign clarifications

**Goal:** a round of questions in a new format, written from one writing reference, held there by
`ura check`, and drawn as cards with typed opening parts, grouped settled points, and diagrams.

**Architecture:** the core owns the format, as the spec's [architecture](spec.md#architecture) says.
`clarifications/letters.rs` owns how an answer's letters are read, for the follow-ups, the page, and
`ura check`. `items/round.rs` builds the context parts, the settled groups, and each question's "Why
it matters" from the document tree. `check/sections.rs` takes the required parts from the embedded
template, and a new `check/writing.rs` owns the writing limits and the three warnings. Findings gain
a `Severity`: the CLI and the language server show warnings, and nothing that stops a step reads
them ([R1](rulings.md#r1-warnings-stay-out-of-a-features-problems-in-the-web-ui-and-the-steps)). The
web UI draws what the core sends: `RoundPage` is split into `RoundOpening`, `QuestionCards`, and
`SettledGroups`; `Blocks` routes `mermaid` code to `Diagram`, and gives tables their column floor on
every page. The writing reference, `skills/uraeda/references/writing.md`, is the one home of the
writing rules; the other references link to it.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

1. **A follow-up of a parent answered "A and B"**: both follow-ups show, in letter order, each a
   card after the parent's. Task 10.
2. **An answer whose letters end with a full stop and nothing after it**, "B.", picks B with an
   empty comment, and "B, C and D" with D not an option picks B, with the comment "C and D": the
   letters are the longest run of joined letters followed by an end mark or the end, and "A and B
   are both bad" has none. Task 2.
3. **A settled point whose subject repeats across two groups** keeps its comment on the first one,
   as today: subjects stay unique. Task 4.
4. **A sentence warning inside a nested list item** is reported on that item's own line, not the
   list's first line. Task 5.
5. **The mermaid chunk is never in the main bundle**: a test reads the build's manifest. Task 8.
6. **A round saved while its "Under the hood" fold is open** keeps the fold open after the save
   reloads the round. Task 11.

## Global constraints

From the spec, word for word:

- The block's verdict is its first item, starting "Verdict:". Its words are "worth building as
  proposed", "worth building, with changes", or "not as proposed".
- The four Context parts are required, and "Since the last round" is required in later rounds. The
  three settled groups are optional one by one, but every point sits in one.
- The sentence limit is 25 words, and the block's is 7 items. The warnings run on files with
  `status: awaiting-human` only.
- Warnings print after errors, as `warning: <file>:<line>: <message>`, and `ura check` exits 0 when
  it found only warnings. The language server sends them with the Warning severity.
- Messages: `block.count` "the block says 1 follow-up, the round has 2"; `block.items` "the block
  has 8 items: keep at most 7"; `writing.sentence` "a sentence of 31 words: split it at 25".
- Letters: option letters at the answer's start, joined by `, `, `and`, or `, and `, and ended by
  `:`, `,`, `.`, or the end. Everything after the letters and their end mark is the comment.
- The time estimate: the words at 250 a minute, plus a minute per question or follow-up, rounded up
  to 5 minutes.
- Exact texts: "Comment, or your own answer instead of a letter"; "Q1.B · follows Q1, because you
  picked B"; "Show the N points", then "Fold"; "Anything else"; "Settled without you"; "This diagram
  could not be drawn."; the frame's title "Diagram".
- Sizes: `--size-round-split: 840px`, `--size-round-measure: 75ch`; tables
  `proportional(1, { minWidth: 144 })`; two columns 5 to 6; follow-ups indented by `--spacing-6`,
  joined by a 4 px accent line, and on the phone a 4 px accent line with `--spacing-3` of inset.
- Icons: Astryx's `warning`, `info`, and `wrench`, for "Check these", "Behaviour", and "Under the
  hood".

From [diagrams](../decisions/diagrams.md):

- The web UI MUST render diagrams at Mermaid's `sandbox` security level, so each diagram is drawn in
  a sandboxed frame without scripts or the app's origin.
- The web UI MUST load `mermaid` only when a page holds a diagram, in a chunk of its own.
- A diagram that fails to render MUST show its source as a code block, with the line "This diagram
  could not be drawn."
- `mermaid` pinned to an exact version in `packages/web` (12.2.0, already there).

From [compatibility](../decisions/compatibility.md):

- A change to the format of a workflow file MUST NOT keep the old format working: no fallback
  reading, no migration code, no optional section kept only for older files.
- A feature that changes a format MUST update the skill's templates and examples, the fixtures, and
  the files of the default branch that the change makes fail `ura check`, in the same branch.

From [code quality](../decisions/code-quality.md): functions at most 100 lines, files at most 500, 7
parameters, 4 levels of nesting; a new marker MUST NOT be added.

Preserved: answers keep their code blocks as written
([`clarifications.rs` tests](/crates/core/src/files/clarifications.rs)); comments on settled points
key on their bold subject; Submit flips the block's first paragraph only
([`markdown.rs`](/crates/core/src/files/markdown.rs)); saves are refused while an agent works.

## Code read

- Core round: [`items/round.rs`](/crates/core/src/files/items/round.rs) builds `RoundItems`;
  `named_section` uses [`items.rs`](/crates/core/src/files/items.rs) `section()`, which drops
  headings. [`clarifications.rs`](/crates/core/src/files/clarifications.rs), 494 lines:
  `picked_letters` and `Applicability::Unclear` feed `applies()`; `split_answer` feeds the page;
  `compose_answer` writes answers. [`check/answers.rs`](/crates/core/src/check/answers.rs) asks for
  `-` on unclear follow-ups.
- Core checks: [`check/sections.rs`](/crates/core/src/check/sections.rs) reads the embedded
  template; any `###` fixed heading in the template is already required unless its placeholder
  starts `[Optional`. [`check/mod.rs`](/crates/core/src/check/mod.rs) `check_file`. `Problem` is in
  [`workspace.rs`](/crates/core/src/workspace.rs), shown by
  [`cli/check.rs`](/crates/cli/src/check.rs), [`lsp/diagnostics.rs`](/crates/lsp/src/diagnostics.rs)
  (always `ERROR`), and `api::checked()`.
- Core tests: `crates/core/tests/{items,check,files,triage}.rs`, helpers in
  `crates/core/tests/common/texts.rs` (`clarifications()` writes an old-format round used by many
  tests); `crates/cli/tests/check.rs` (`every_broken_fixture_fails`).
- Web: [`RoundPage.tsx`](/packages/web/src/RoundPage.tsx) (`RoundPage` ~98 lines),
  [`Question.tsx`](/packages/web/src/Question.tsx) (`Question` ~98, raw `<button>` options with an
  `oxlint-disable` at line 192, "Does not apply" at 264),
  [`SettledPoints.tsx`](/packages/web/src/SettledPoints.tsx) (426 lines, `SettledPoints` ~102),
  [`Blocks.tsx`](/packages/web/src/Blocks.tsx) (439 lines, `blockElement` ~85, `TableNode` with
  Astryx `Table`, no `columns`), `useAnswer.ts` (`notApplying`), `layout/useWidthClass.ts` (media
  query only: no width hook yet), `theme/theme.ts` (`localTokens`, `--size-reading-measure: 90ch`).
- Mockups: [`mockups/RoundMockup.tsx`](/packages/web/src/mockups/RoundMockup.tsx) and
  [`mockups/RichBlocks.tsx`](/packages/web/src/mockups/RichBlocks.tsx), marked TEMPORARY: the picked
  card layout, `SelectableCard` options, the sticky phone head, the groups, the `Diagram` and
  `ScrollTable` sketches. Their round is in `.storybook/roundMockup.ts`.
- Web tests: happy-dom in `src/__tests__/` (`renderPage`, `atWidth`, `fixtureRepo` in
  `helpers.tsx`), over the web-ui fixture round; browser tests in `src/__browser__/` at 402 × 874
  and 1440 × 900 (`atSize`, `show`, `checkLayout`, `checkAccessibility`); screenshots by
  `vp run --filter uraeda-web screenshots`, committed under `specs/<folder>/screenshots/`.
- Validation: `nix develop -c vp run ready` (every check); fast loops
  `cargo nextest run -p uraeda-core`, `vp check`, `vp test --project '!phone' --project '!desktop'`,
  `vp test --project phone|desktop`. The baseline run fails only `specs:check`, on two links: this
  feature's proposal (fixed in task 3) and `specs/drafts/look-and-feel/proposal.md:34`, from the
  default branch.

## Constitution check

| Principle                         | Complies | Notes                                                            |
| --------------------------------- | -------- | ---------------------------------------------------------------- |
| I. Humans stay in control         | yes      | the verdict leads the block; no decision beyond the two approved |
| II. Git and plain text first      | yes      | the format stays Markdown; diagrams are Mermaid text             |
| III. Asynchronous by default      | yes      | no change to how rounds are committed                            |
| IV. Review effort matches impact  | yes      | settled points grouped by what the human checks                  |
| V. Tools are optional             | yes      | every warning measures a rule the writing reference states       |
| VI. Code is checked, maintainable | yes      | four units split before they grow; every scenario has a test     |

## Decisions

- [Diagrams](../decisions/diagrams.md): task 8.
- [Compatibility](../decisions/compatibility.md): task 3 rewrites every round the change breaks.
- [Stack](../decisions/stack.md): the core owns the format; tasks 2 to 5.
- [UI layout](../decisions/ui-layout.md), [UI components](../decisions/ui-components.md), and
  [UI checks](../decisions/ui-checks.md): tasks 7 to 12.
- [Code quality](../decisions/code-quality.md): the structural steps of tasks 2, 9, 10, and 11.

## Complexity tracking

| Addition                            | Why                                                                    | Simpler alternative rejected                         |
| ----------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| `Severity` on `Problem`             | warnings must not fail `ura check` or stop a step                      | a second list of findings: every reader would merge  |
| `check/writing.rs`                  | the limits live in one module, as the spec asks                        | numbers in `sections.rs`: unrelated responsibilities |
| `ContextPart`, `SettledGroup` types | the page draws each part and group with its heading                    | sending headings as blocks: the page would re-parse  |
| `useWidthOf` hook in `layout/`      | the card picks its columns by its own width, which the layout requires | a media query: wrong with the sidebar and index open |
| `Diagram` component                 | loads `mermaid` on demand in its own chunk                             | none: the decision requires it                       |

## Review comments

- **C1** (write in the specs redesign draft on the default branch to separate the answers to review
  comments from the spec from revision 2 on): task 1.

---

## Task 1: The specs redesign draft notes the separated review answers

**Files:**

- Modify: `specs/drafts/redesign-specs.md`, on the default branch, in the main checkout

- [x] **Step 1: Add a line under the draft's `## What`**: from a spec's revision 2 on, the answers
      to the human's review comments ("C1: done", ...) are set apart from the spec itself, rather
      than mixed into its opening block. Name the spec review of the clarifications redesign as
      where it was asked.
- [x] **Step 2: Commit on the default branch**, after checking its checkout has no other change:
      `chore: the specs redesign separates review answers from the spec`

## Task 2: One reading of an answer's letters

**Risky:** changes a rule several callers share: follow-ups, the page's picked letters, and
`ura check`'s blank answers.

**Files:**

- Create: `crates/core/src/files/clarifications/letters.rs`
- Modify: `crates/core/src/files/clarifications.rs`, `crates/core/src/files/items/round.rs`,
  `crates/core/src/check/answers.rs`, `packages/web/src/Question.tsx`,
  `packages/web/src/useAnswer.ts`
- Test: `crates/core/tests/items.rs`, `crates/core/tests/check.rs`, `crates/core/tests/files.rs`,
  `packages/web/src/__tests__/round.test.tsx`

**Interfaces:**

- Produces: `pub fn letters(answer: &str, options: &[char]) -> Vec<char>` and
  `pub fn split_answer(answer: &str, options: &[char]) -> (Vec<String>, String)`, both in
  `clarifications::letters` and re-exported from `clarifications`; `split_answer` is built on
  `letters`. `Applicability` is `Yes | No`. `QuestionItem.applies` is `"yes"` or `"no"`.
  `compose_answer` moves with them, unchanged.

- [x] **Step 1: Structural: move `picked_letters`, `split_answer`, and `compose_answer`, with their
      unit tests, into `clarifications/letters.rs`.** Run `cargo nextest run -p uraeda-core`, PASS
      before and after. Commit
      `refactor(redesign-clarifications): answers' letters in a module of     their own`.
- [x] **Step 2: Write the failing tests**
  - `items.rs`, table-driven `answers_are_split_into_letters_and_comment`, rows replaced:
    `("C, we want a simple feature", ["C"], "we want a simple feature")`,
    `("B, let's not overload the interface", ["B"], "let's not overload the interface")`,
    `("B.", ["B"], "")`, `("A mix of both would be better", [], "A mix of both would be better")`,
    `("C but with napi-rs", [], "C but with napi-rs")`, `("A, B and C", ["A","B","C"], "")`,
    `("B and C: weekdays matter", ["B","C"], "weekdays matter")`, `("B, C and D", ["B"], "C and D")`
    with options A to C (review focus 2, R9). Breaks caught: a comma read as a joint swallowing
    "let's"; a letter followed by a word read as picked.
  - `files.rs`, replacing the unclear rows: a follow-up whose parent answered "keep it simple"
    `applies` is `No`, and it is not `asked`. Break: a comment-only parent leaving its follow-ups
    waiting.
  - `check.rs` `unclear_follow_up` becomes `a_follow_up_of_a_comment_alone_needs_no_answer`: an
    answered round whose Q1 is "keep it simple" and Q1.B blank reports nothing.
  - `round.test.tsx`: "a follow-up whose parent names no option can be marked as not applying"
    becomes "a comment alone closes its follow-ups" (US5.2): answer Q1 with the comment "Neither:
    keep the last 10 completions" and no letter; Q1.B is not on the page, there is no "Does not
    apply" button, and "1 question left" does not count Q1.B.
- [x] **Step 3: Run them to check they fail**: `cargo nextest run -p uraeda-core`: FAIL on
      `"C, we want a simple feature"`, expected `["C"]`.
- [x] **Step 4: Implement** `letters()` per the global constraints, `split_answer` on it,
      `applies()` without `Unclear` (no letter: `No`), `check_answers` without the `-` hint,
      `round.rs` without `"unclear"`; remove `notApplying`, the "Does not apply" button, and the
      "names no option" label from the web.
- [x] **Step 5: Run the project's validation**: `cargo nextest run`, `vp check`,
      `vp test --project '!phone' --project '!desktop'`: PASS.
- [x] **Step 6: Commit** `feat(redesign-clarifications): an answer's letters are read one way`

## Task 3: The round's new format, and every round rewritten in it

**Risky:** changes the format of files humans and agents write, with no old format kept.

**Files:**

- Modify: `skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md`,
  `crates/core/src/check/sections.rs`, `crates/core/tests/common/texts.rs`
- Rewrite in the new format:
  `skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md` (answers and
  notes kept, close to the mockup's round), every round under `fixtures/` except the ones broken on
  purpose, which keep only their intended problem,
  `specs/2026-10-17-redesign-clarifications/clarifications-01.md` and
  `specs/backlog/benchmarks/clarifications-01.md` (content, answers, and notes kept)
- Create: `fixtures/round-mockup/clarifications-01.md` and its `proposal.md`, from
  `.storybook/roundMockup.ts`, which moves into `.storybook/fixture.ts`, reading them
  ([R5](rulings.md#r5-the-mockups-round-becomes-a-fixture-file))
- Modify: `specs/2026-10-17-redesign-clarifications/proposal.md`, its broken link
  ([R6](rulings.md#r6-the-proposals-broken-link-is-fixed))
- Test: `crates/core/tests/check.rs`

**Interfaces:**

- Produces: the template's sections: `## Context` with `### Since the last round` (placeholder
  `[Optional ...`), `### Goal`, `### Today`, `### Scope`, `### Sources`; questions as today, with a
  "Why it matters" paragraph; `## Settled without the human` with `### Check these`,
  `### Behaviour`, `### Under the hood`, each `[Optional ...`. New rule ids `settled.group`, and
  `sections.unknown` for `###` headings. `texts::clarifications()` writes the new format.

- [x] **Step 1: Write the failing tests** in `check.rs`, on a copy of the example round:
  - US1.1: the example and the template's skeleton filled with text report nothing.
  - US1.2: without `### Sources`: `sections.missing` for `"### Sources"`, and `ura check` exits 1
    (in `crates/cli/tests/check.rs`).
  - US1.3: a point directly under `## Settled without the human`: `settled.group` on that point's
    line. Break: a check that only looks for the group headings.
  - Edge: `### Risks` under Context, and under the settled points: `sections.unknown` on its line;
    `### Q1.B:` under a question is not reported.
  - A `clarifications-02.md` without `### Since the last round`: `sections.missing`; with it, before
    `### Goal`, nothing. After `### Goal`: `sections.order`.
  - The triage with a free Context and no settled section reports nothing.
  - R4: a record with `#### Context` and `##### Goal` under `### Round 01` reports nothing.
- [x] **Step 2: Run them to check they fail**: `cargo nextest run -p uraeda-core --test check`:
      FAIL, the template has no `### Sources` yet.
- [x] **Step 3: Implement**: the template; in `sections.rs`, in a round, a `###` heading under a
      level-2 section whose template children are fixed headings must be one of them
      ([R7](rulings.md#r7-unknown--headings-are-reported-in-rounds-only)); "Since the last round"
      required when the file's round number is above 1; `settled.group` for a list under the settled
      section before its first `###`. Then rewrite every round listed above, and the helper.
- [x] **Step 4: Run the project's validation**: `nix develop -c vp run ready`, with `specs:check`
      failing only on `specs/drafts/look-and-feel/proposal.md`. PASS otherwise.
- [x] **Step 5: Commit**
      `feat(redesign-clarifications): the round's new format, every round rewritten in it`

## Task 4: The core sends the context parts, the settled groups, and "Why it matters"

**Files:**

- Modify: `crates/core/src/files/items.rs` (types), `crates/core/src/files/items/round.rs`,
  `packages/binding/index.d.ts` (regenerated), `packages/web/src/RoundPage.tsx`,
  `packages/web/src/SettledPoints.tsx`, `packages/web/src/Question.tsx` (read the new fields as they
  draw today)
- Test: `crates/core/tests/items.rs`

**Interfaces:**

- Produces, in `RoundItems`: `context: Vec<ContextPart>` with
  `ContextPart { heading: Option<u32>, title: String, blocks: Vec<u32> }` (the triage's one part has
  no heading and an empty title); `settled_groups: Vec<SettledGroup>` with
  `SettledGroup { heading: u32, kind: String, blocks: Vec<u32> }`, `kind` one of `check`,
  `behaviour`, `hood`, replacing `settled`; `QuestionItem.why: Option<u32>`, left out of `context`.
  In TypeScript, `ContextPart`, `SettledGroup`, and `QuestionItem.why`.

- [x] **Step 1: Write the failing tests**: on the example round, `context` titles are
      `["Goal", "Today", "Scope", "Sources"]`; a `clarifications-02.md` gives
      `"Since the last round"` first (US2.2's data); Q1's `why` is the paragraph starting "Why it
      matters" and is not in its context; the groups' kinds are in file order with their points;
      review focus 3: a subject repeated in two groups points its comment at the first.
- [x] **Step 2: Run them to check they fail**: FAIL, no field `why`.
- [x] **Step 3: Implement** in `round.rs`, keeping sub-headings, then regenerate the binding
      (`vp run binding:build`) and make the web draw each part's heading and blocks, and each
      group's blocks, as it draws today.
- [x] **Step 4: Run the project's validation**: `cargo nextest run`, `vp check`, the unit tests.
- [x] **Step 5: Commit** `feat(redesign-clarifications): the core sends a round's parts and groups`

## Task 5: Warnings, and the writing limits in one module

**Files:**

- Create: `crates/core/src/check/writing.rs`
- Modify: `crates/core/src/workspace.rs` (`Problem.severity`), `crates/core/src/check/mod.rs`,
  `crates/core/src/api.rs` (`checked()` keeps errors,
  [R1](rulings.md#r1-warnings-stay-out-of-a-features-problems-in-the-web-ui-and-the-steps)),
  `crates/cli/src/check.rs`, `crates/lsp/src/diagnostics.rs`
- Test: `crates/core/tests/check.rs`, `crates/cli/tests/check.rs`, `crates/lsp/tests/`,
  `crates/core/tests/actions.rs`

**Interfaces:**

- Produces: `pub enum Severity { Error, Warning }`, serialized `error` / `warning`, and
  `Problem.severity`, `Error` by default from `File::problem`; `File::warning(line, rule, message)`.
  `writing.rs` holds `SENTENCE_WORDS = 25`, `BLOCK_ITEMS = 7`, and
  `check_writing(file, document, problems)`, run on clarifications and triage files with
  `status: awaiting-human`.

- [ ] **Step 1: Write the failing tests**
  - US1.4: block "3 questions and 1 follow-up, about 15 minutes." over 3 questions and 2 follow-ups:
    warning `block.count` "the block says 1 follow-up, the round has 2", and `ura check` exits 0,
    printing `warning: <file>:<line>: <message>` after the errors.
  - US1.5: an option sentence of 31 words: `writing.sentence` "a sentence of 31 words: split it at
    25" on its line; the same sentence in a quote, a table, code, or the answer: nothing (R2).
    Review focus 4: in a nested item, on the item's line.
  - US1.6: 8 items: `block.items` "the block has 8 items: keep at most 7".
  - The same round `answered`: no warning.
  - US1.8, SC-002, SC-005: the example round, the template, and every fixture round not broken on
    purpose report neither problem nor warning; the example round measured as if waiting has no
    sentence over 25 words and at most 7 block items.
  - US1.7 (`actions.rs`): submitting a waiting round whose first block item starts "Verdict:" gives
    "> [!NOTE]", "Answered on 2026-10-18.", and keeps the verdict item.
  - The language server sends a warning with `DiagnosticSeverity::WARNING`.
- [ ] **Step 2: Run them to check they fail**: FAIL, no field `severity`.
- [ ] **Step 3: Implement** the severity, the three warnings, the CLI's output and exit code, the
      language server's severity, and `checked()`'s filter.
- [ ] **Step 4: Run the project's validation**: `cargo nextest run`,
      `cargo clippy --workspace     --all-targets -- -D warnings`, `vp check`.
- [ ] **Step 5: Commit**
      `feat(redesign-clarifications): ura check warns when a round's writing drifts`

## Task 6: The writing reference, and the skill's text

**Files:**

- Create: `skills/uraeda/references/writing.md`,
  `skills/uraeda/assets/example/specs/changes/2026-10-14-tasks-reappear/clarifications-01.md`
  (waiting, with its block, in the new format)
- Modify: `skills/uraeda/SKILL.md` (link for the block, the `-` rule dropped),
  `references/discovery.md` (questions file sections link to writing.md; verdict from "Worth it and
  feasibility"), `spec.md`, `change.md`, `conventions.md` (Mermaid code blocks), `finish.md` (R4),
  `inbox.md`, `cli.md` (warnings), the triage template's wording, `README.md` if it describes the
  round
- Test: `crates/core/tests/check.rs` (the example change round reports nothing; the skill's links
  resolve, through the existing skill link test)

- [ ] **Step 1: Write the failing test**: the example change's round passes `ura check` with no
      warning, and its Sources has no discovery link.
- [ ] **Step 2: Run it to check it fails**: FAIL, no such file.
- [ ] **Step 3: Write** `writing.md`: numbered rules, each with its reason and limit: the block's
      shape (count line, verdict first, at most 7 items), the Context's parts and what each holds,
      sentences of at most 25 words, terms defined at first use, never an ID from a file the reader
      has not seen, never an answer cited by number alone, adequate context as its own rule (no
      length limit, no padding, tables, quotes, diagrams), the settled groups and their order, the
      time estimate's formula, and the self-review reading each card alone. Numbers match
      `writing.rs`. Then the other references, linking to it instead of repeating it.
- [ ] **Step 4: Run the project's validation**: `cargo nextest run -p uraeda-core`, `vp check`.
- [ ] **Step 5: Commit**
      `docs(redesign-clarifications): the writing reference, shared by every document for the human`

## Task 7: Tables keep a column floor and scroll in their own region

**Files:**

- Modify: `packages/web/src/Blocks.tsx` (`TableNode`; split `blockElement` first if it grows)
- Test: `packages/web/src/__browser__/blocks.test.tsx` (new)

- [ ] **Step 1: Write the failing tests** (US2.5, edge case wide table), phone and desktop: a
      3-column table in a round: each header cell at least 144 px wide, the table's region
      `scrollWidth > clientWidth`, and `document.documentElement.scrollWidth` equal to the window's
      width; cells keep their links.
- [ ] **Step 2: Run them to check they fail**: `vp test --project phone`: FAIL, a column under 144.
- [ ] **Step 3: Implement** with Astryx's `columns`, each `proportional(1, { minWidth: 144 })`,
      keeping cells' spans and the selection toggles.
- [ ] **Step 4: Run the project's validation**: `vp check`, the unit tests,
      `vp test --project     phone`, `vp test --project desktop`.
- [ ] **Step 5: Commit**
      `feat(redesign-clarifications): tables keep their columns and scroll in place`

## Task 8: Diagrams

**Risky:** security: a diagram's text comes from files an agent writes.

**Files:**

- Create: `packages/web/src/Diagram.tsx`
- Modify: `packages/web/src/Blocks.tsx`
- Test: `packages/web/src/__browser__/diagram.test.tsx` (new),
  `packages/web/src/__tests__/build.test.ts`

- [ ] **Step 1: Write the failing tests**
  - US6.1: a question with a flowchart: an `iframe` titled "Diagram" whose `sandbox` has neither
    `allow-scripts` nor `allow-same-origin`.
  - US6.2: "flowchart LR\n A -->": "This diagram could not be drawn." over the source as code.
  - US6.4: dark mode: the frame's SVG carries Mermaid's dark theme colours.
  - Edge: a wide diagram scrolls inside its card; the page does not scroll sideways.
  - US6.3, SC-003, review focus 5: a spec page with no diagram requests no `mermaid` chunk, and the
    build's main chunk does not contain mermaid.
- [ ] **Step 2: Run them to check they fail**: FAIL, the block shows as code.
- [ ] **Step 3: Implement** `Diagram`: `import("mermaid")` on demand, `securityLevel: "sandbox"`,
      `neutral` or `dark` by colour mode, the fallback on parse or load errors.
- [ ] **Step 4: Run the project's validation**: `vp check`, unit tests, both browser projects,
      `vp run web:build`.
- [ ] **Step 5: Commit** `feat(redesign-clarifications): Mermaid diagrams in a sandboxed frame`

## Task 9: The round's opening

**Files:**

- Create: `packages/web/src/RoundOpening.tsx`
- Modify: `packages/web/src/RoundPage.tsx` (split first), `packages/web/src/theme/theme.ts`,
  `packages/web/src/RoundPage.stories.tsx` (the real page over the mockup fixture)
- Test: `packages/web/src/__tests__/round.test.tsx`

- [ ] **Step 1: Structural: split `RoundPage` into the opening, the questions, and the end**, no
      behaviour change; tests PASS before and after. Commit
      `refactor(redesign-clarifications): the round page in three parts`.
- [ ] **Step 2: Write the failing tests**: US2.1 headings "Goal", "Today", "Scope", "Sources" in
      order under the block; US2.2 "Since the last round" above "Goal"; US2.3 the "Why it matters"
      paragraph in a muted box after the context, not within it; US2.4 a table and a quote in a
      question's card.
- [ ] **Step 3: Run them to check they fail**.
- [ ] **Step 4: Implement**: `RoundOpening` draws the block then each part;
      `--size-round-split:     840px` and `--size-round-measure: 75ch`; the stories render the real
      `RoundPage`.
- [ ] **Step 5: Run the project's validation**.
- [ ] **Step 6: Commit**
      `feat(redesign-clarifications): the round opens with its verdict and its parts`

## Task 10: Question cards

**Files:**

- Create: `packages/web/src/QuestionCard.tsx`, `packages/web/src/QuestionCards.tsx`,
  `packages/web/src/layout/useWidthOf.ts`
- Modify: `packages/web/src/Question.tsx` (split first; its options become `SelectableCard`s, the
  `oxlint-disable` removed), `packages/web/src/QuestionComment.tsx` (the label),
  `packages/web/src/QuestionCard.stories.tsx`
- Test: `packages/web/src/__tests__/round.test.tsx`, `packages/web/src/__browser__/round.test.tsx`

**Interfaces:**

- Produces: `useWidthOf(ref: RefObject<HTMLElement | null>): number`.

- [ ] **Step 1: Structural: split `Question` into its header, options, and comment.** Commit.
- [ ] **Step 2: Write the failing tests**
  - US3.1, SC-001: at 1440 × 900 with the sidebar and index open, each option's left is right of its
    title's right.
  - US3.2, SC-001: at 402 × 874, options follow the context, no card around the question, options as
    wide as the screen, no sideways scroll.
  - US3.3, edge three-line title: scrolled to Q1's option C, Q1's title is at the top, whole.
  - US3.4: a question with story variants is one column at 1440.
  - US3.5: tapping B shows "Q1.B · follows Q1, because you picked B" after Q1's card, outside it.
  - US3.6: tapping B again removes Q1.B's card, and the index lists Q1 alone.
  - Review focus 1: "A and B" shows both follow-ups after the parent, in letter order.
  - US3.7: Tab to an option card, Space: its letter is picked and saved.
  - US5.1: the comment field is labelled "Comment, or your own answer instead of a letter".
  - Edges: B to C removes Q1.B's card and keeps its answer on disk; an answered round's options
    cannot be tapped.
- [ ] **Step 3: Run them to check they fail**.
- [ ] **Step 4: Implement** the card, from `RoundMockup`'s `QuestionCard`: a `Card` on wide screens,
      two columns 5 to 6 at `--size-round-split`; the phone's sticky head below the top bar;
      follow-up cards; the index entries unchanged.
- [ ] **Step 5: Run the project's validation**, both browser projects included.
- [ ] **Step 6: Commit**
      `feat(redesign-clarifications): each question a card, its follow-up a card of its own`

## Task 11: Settled groups, and "Anything else"

**Files:**

- Create: `packages/web/src/SettledGroups.tsx`
- Modify: `packages/web/src/SettledPoints.tsx` (split first), `packages/web/src/RoundNotes.tsx`
- Test: `packages/web/src/__tests__/settled.test.tsx`

- [ ] **Step 1: Structural: move the settled point's form and notices out of `SettledPoints.tsx`.**
      Commit.
- [ ] **Step 2: Write the failing tests**: US4.1 "Check these" and "Behaviour" show their points,
      "Under the hood" shows "Show the 2 points"; US4.2 open, reload, still open; review focus 6:
      open, save an answer, still open; US4.3 a comment on a hood point writes
      `- **Next dates are computed by date-fns**: Use Temporal instead`; US4.4 the notes field is
      labelled "Anything else"; a missing group is not drawn.
- [ ] **Step 3: Run them to check they fail**.
- [ ] **Step 4: Implement**: "Settled without you", each group with its icon and heading; the fold
      in the URL's hash through `useHashFold`.
- [ ] **Step 5: Run the project's validation**.
- [ ] **Step 6: Commit** `feat(redesign-clarifications): settled points grouped by what you check`

## Task 12: The triage, accessibility, and screenshots

**Files:**

- Modify: `packages/web/src/TriagePage.tsx` if needed, `packages/web/scripts/screenshots.ts`
- Delete: `packages/web/src/mockups/RoundMockup.tsx`, `packages/web/src/mockups/RichBlocks.tsx`
- Test: `packages/web/src/__tests__/triage.test.tsx`, `packages/web/src/__browser__/round.test.tsx`
- Create: `specs/2026-10-17-redesign-clarifications/screenshots/`

- [ ] **Step 1: Write the failing tests**: the triage's questions are cards, its Context free, and
      it shows no settled groups; SC-004 axe passes on the round in light and dark, with a diagram,
      a follow-up, and every group open.
- [ ] **Step 2: Run them to check they fail**.
- [ ] **Step 3: Implement** what fails, remove the TEMPORARY mockups, and take the screenshots of
      the round and the triage at both sizes in both themes.
- [ ] **Step 4: Run the project's validation**: `nix develop -c vp run ready`.
- [ ] **Step 5: Commit** `feat(redesign-clarifications): the triage takes the new round page`
