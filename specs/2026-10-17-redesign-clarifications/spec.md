---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Redesign clarifications

> [!IMPORTANT]
>
> Spec to review, about 25 minutes.
>
> - Two new decisions:
>   - [Diagrams](../decisions/diagrams.md): Mermaid in workflow files, drawn in a sandboxed frame.
>     The dependency adds 114 packages, and a 500 KB chunk loaded only by pages with a diagram.
>   - [Compatibility](../decisions/compatibility.md): no backward compatibility before 1.0, as your
>     note asked. Every round written in the old format fails `ura check` once this merges. No
>     branch in flight holds one today.
> - Your "MORE context, do not limit it" is read as: no length limit on a question's context. The
>   sentence-length warning you picked still applies everywhere, context included. Long context
>   splits into short sentences, tables, quotes, and diagrams.
> - "Put it in later" is read as a line in the priorities' **Later** section: it is added on `main`.
> - A comment alone now closes its question's follow-ups. The skill's `-` answer, and the "Does not
>   apply" button, are removed.
> - Two columns start at a card width of 840 px, which a 1440 px screen gives with the sidebar and
>   the question index open. Narrower cards, and questions with story variants, stay in one column.
> - Risk tier `medium`: a format change to files users write, and a new dependency. The plan does
>   not wait for your review.

A round of questions becomes quick to read once, top to bottom. It opens with a verdict on the
proposal and typed facts. Each question is a card with room for context. The settled points are
grouped by what you would check. Any model writes it the same way, following one writing reference
shared with the specs redesign. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## User stories

### US1: An agent writes a round in the new format, and `ura check` holds it there (P1)

An agent follows the writing reference and the template. The block opens with the count, the time,
and a verdict. The Context section has four parts under sub-headings. Questions keep "Why it
matters" and as much context as they need. Settled points sit in three groups. `ura check` refuses a
missing part, and warns when the writing drifts.

Why this priority: every other story draws or reads this format.

Acceptance scenarios:

1. **Given** a round whose `## Context` has `### Goal`, `### Today`, `### Scope`, and `### Sources`,
   and whose settled points sit under `### Check these`, `### Behaviour`, and `### Under the hood`,
   **When** `ura check` runs, **Then** it reports nothing.
2. **Given** a round whose `## Context` has no `### Sources`, **When** `ura check` runs, **Then** it
   reports `sections.missing` for "Sources", and exits with an error.
3. **Given** a round with a settled point directly under `## Settled without the human`, before any
   group, **When** `ura check` runs, **Then** it reports `settled.group` on that point's line.
4. **Given** a waiting round with 3 questions and 2 follow-ups, whose block opens "3 questions and 1
   follow-up, about 15 minutes.", **When** `ura check` runs, **Then** it warns `block.count` "the
   block says 1 follow-up, the round has 2", and exits with success.
5. **Given** a waiting round with an option sentence of 31 words, **When** `ura check` runs,
   **Then** it warns `writing.sentence` "a sentence of 31 words: split it at 25" on its line.
6. **Given** a waiting round whose block has 8 items, **When** `ura check` runs, **Then** it warns
   `block.items` "the block has 8 items: keep at most 7".
7. **Given** a waiting round whose block's first item starts "Verdict:", **When** the human submits
   it, **Then** the block reads "> [!NOTE]", "Answered on 2026-10-18.", and keeps the verdict item.
8. **Given** the skill's example round, **When** `ura check` runs, **Then** it reports neither a
   problem nor a warning.

### US2: The round opens with its verdict and its typed facts (P1)

The page draws the block, then the Context section's sub-headings and their content: tables, quotes,
and diagrams. In each question, "Why it matters" is set apart from the context above it.

[Round waiting for answers](/packages/web/src/RoundPage.stories.tsx#Waiting)

Why this priority: it is the first thing read in every round.

Acceptance scenarios:

1. **Given** a round with the four Context parts, **When** the human opens it, **Then** the page
   shows the headings "Goal", "Today", "Scope", and "Sources", in that order, under the block.
2. **Given** a later round with `### Since the last round` first in its Context, **When** the human
   opens it, **Then** "Since the last round" shows above "Goal".
3. **Given** a question whose context ends with the paragraph "Why it matters: it decides whether
   completed occurrences stay as a history.", **When** the human opens the round, **Then** that
   paragraph shows in a muted box after the context, and not within it.
4. **Given** a question whose context holds a table and a quote, **When** the human opens the round,
   **Then** both show in the question's card.

### US3: Each question is a card, its follow-up a card of its own (P1)

Each question is a card with a large title. On a wide card, the title and context sit on the left,
and the options and comment on the right. Options are cards to tap. A follow-up shows as its own
card once its letter is picked, after its parent's, joined to it by a line.

[Question cards](/packages/web/src/QuestionCard.stories.tsx#TwoColumns)

Why this priority: it is the proposal's main complaint, and every round shows it.

Acceptance scenarios:

1. **Given** a window 1440 px wide with the sidebar and the question index open, **When** the human
   opens a round, **Then** each question's options start to the right of its title.
2. **Given** a window 402 px wide, **When** the human opens the same round, **Then** each question's
   options follow its context, in one column.
3. **Given** a question with an option that holds story variants, at 1440 px, **When** the human
   opens the round, **Then** that question's card is one column.
4. **Given** Q1 with a follow-up Q1.B, **When** the human taps option B of Q1, **Then** a card
   headed "Q1.B · follows Q1, because you picked B" shows after Q1's card, outside it.
5. **Given** Q1 answered B with Q1.B shown, **When** the human taps option B again, **Then** Q1.B's
   card goes, and the index lists Q1 alone.
6. **Given** an option card, **When** the human focuses it with Tab and presses Space, **Then** its
   letter is picked and the answer saves.

### US4: Settled points are grouped by what you check (P1)

The settled points show in three groups, each with an icon: "Check these" first, then "Behaviour".
"Under the hood" starts folded, with the count of its points. Commenting on a point works in every
group.

[Round waiting for answers](/packages/web/src/RoundPage.stories.tsx#Waiting)

Why this priority: scope cuts drew four times the reactions of other points, and sat among them.

Acceptance scenarios:

1. **Given** a round with 2 points to check, 3 behaviour points, and 2 under the hood, **When** the
   human opens it, **Then** "Check these" and "Behaviour" show their points, and "Under the hood"
   shows "Show the 2 points".
2. **Given** that round, **When** the human taps "Show the 2 points" and reloads the page, **Then**
   "Under the hood" is still open.
3. **Given** a point under "Under the hood", **When** the human opens the group, taps the point, and
   saves "Use Temporal instead", **Then** the notes hold
   `- **Next dates are computed by date-fns**: Use Temporal instead`.
4. **Given** a round, **When** the human reaches its end, **Then** the notes field is labelled
   "Anything else".

### US5: A comment alone answers a question (P2)

The comment field says a comment alone answers. A question answered without a letter closes its
follow-ups, with nothing to mark. A written answer's letters are read one way everywhere.

[Comment alone](/packages/web/src/RoundPage.stories.tsx#CommentOnly)

Why this priority: two answers so far picked a letter only because they felt they had to.

Acceptance scenarios:

1. **Given** a question, **When** the human opens it, **Then** its comment field is labelled
   "Comment, or your own answer instead of a letter".
2. **Given** Q1 with a follow-up Q1.B, **When** the human saves the comment "Neither: keep the last
   10 completions" with no letter, **Then** Q1.B does not show, and Submit does not wait for it.
3. **Given** the answer "B, let's not overload the interface", **When** the round is read, **Then**
   option B shows picked, the comment reads "let's not overload the interface", and Q2.B applies.
4. **Given** the answer "A mix of both would be better", **When** the round is read, **Then** no
   option shows picked, and no follow-up applies.

### US6: Diagrams render in workflow files (P2)

A `mermaid` code block in any workflow file the UI draws shows as a diagram. The diagram comes from
the `mermaid` library, loaded on demand, and drawn in a sandboxed frame.

[Round waiting for answers](/packages/web/src/RoundPage.stories.tsx#Waiting)

Why this priority: you chose diagrams so a round can compare flows, and specs reuse them.

Acceptance scenarios:

1. **Given** a question whose context holds a `mermaid` flowchart, **When** the human opens the
   round, **Then** the diagram shows inside a frame whose `sandbox` attribute omits `allow-scripts`
   and `allow-same-origin`.
2. **Given** a `mermaid` block with the text "flowchart LR\n A -->", **When** the human opens the
   page, **Then** the block's source shows as code, under the line "This diagram could not be
   drawn."
3. **Given** a spec with no diagram, **When** the human opens it, **Then** the page loads no
   `mermaid` chunk.
4. **Given** the dark colour mode, **When** a diagram draws, **Then** it uses Mermaid's `dark`
   theme.

## Edge cases

- A parent's answer changes from B to C: Q1.B's card goes, and its saved answer stays in the file,
  unread by the spec step, as today.
- A parent answered "A and B": the follow-ups of both letters show, each after the parent, in letter
  order.
- The answer "C but with napi-rs" names no letter: it shows as a comment alone. Letters end at a
  colon, a comma, a full stop, or the end of the answer.
- An answered round is read-only: the cards keep their layout, and options cannot be tapped.
- A round with an empty group: the group's heading is left out of the file, and the page shows only
  the groups present.
- An unknown `###` heading in Context or in the settled points: `ura check` reports
  `sections.unknown`.
- The inbox triage shares the page: its questions show as cards, its Context keeps its free form,
  and it has no settled groups.
- A diagram wider than its card scrolls inside its frame, and never scrolls the page sideways.
- A round recorded at finish: its Context and settled sub-headings become `#####` headings in the
  record, under `#### Context` and `#### Settled without the human`.
- An old-format round on a branch in flight fails `ura check` until it is rewritten, as the
  [compatibility](../decisions/compatibility.md) decision allows.

## Success criteria

- **SC-001**: At 1440 × 900, with the sidebar and the index open, every question card of the example
  round draws in two columns. At 402 × 874, every card draws in one column, with no sideways scroll.
- **SC-002**: The example round, the template, and every fixture round pass `ura check` with no
  problem and no warning.
- **SC-003**: A page without a diagram loads no `mermaid` chunk.
- **SC-004**: The round page passes axe in light and dark, with a diagram, a follow-up, and every
  settled group open.
- **SC-005**: The rewritten example round has no sentence over 25 words, and its block has at most 7
  items.

## Architecture

The format has one owner, the core. The skill describes it once, in a new writing reference, and the
page draws what the core sends. See the [discovery's approaches](discovery-01.md#approaches).

- **The writing reference**, `skills/uraeda/references/writing.md`, is the one home of the writing
  rules of every document written for the human. It holds numbered rules, each with its reason and
  its limit, and the shapes of the block and the Context section. The specs redesign extends it.
  `discovery.md` and `SKILL.md` link to it instead of repeating it. The template becomes a bare
  skeleton, and filled examples show a first round and a change's round.
- **The core** reads the new parts. `RoundItems` sends each Context part and each settled group with
  its heading, and each question's "Why it matters". One function reads an answer's letters, for the
  follow-ups and for the page. `ura check` takes the required parts from the template, as today, and
  gains warnings: findings that do not fail the check.
- **The page** splits `RoundPage` into the opening, the question cards, and the settled groups.
  `QuestionCard` measures its own width to pick one or two columns. `Blocks` sends `mermaid` code
  blocks to a `Diagram`, loaded on demand.
- **Where each rule lives**:
  - the format, the letters of an answer, and whether a follow-up applies: in the core;
  - the writing limits: in the writing reference, measured by the core's warnings, with the numbers
    in one module of the core;
  - the 840 px split: in a theme size.
- **Tradeoffs**: two layouts to keep working in the card, a dependency with a security record, and
  rounds in the old format failing `ura check`.

## Mockups

- [Round waiting for answers](/packages/web/src/RoundPage.stories.tsx#Waiting): the block with its
  verdict, the four Context parts with a table, cards in two columns, a diagram, a quote, "Why it
  matters" set apart, a follow-up card, the three settled groups with "Under the hood" folded, and
  "Anything else".
- [Comment alone](/packages/web/src/RoundPage.stories.tsx#CommentOnly): Q1 answered with a comment
  and no letter, its follow-up gone.
- [Question cards](/packages/web/src/QuestionCard.stories.tsx#TwoColumns): the picked card layout
  over the fixture's web UI round, with a follow-up.

Uraeda shows each at a phone's width and a desktop's. The mockups leave out the question index,
which is unchanged, and the settled points' comment forms, which work as today.

## Assumptions

Settled in the [clarifications](clarifications-01.md#settled-without-the-human):

- A comment alone answers, and the page says so. Its follow-ups do not apply, which removes the
  skill's `-` answer.
- An answer's letters are read by one function.
- Git chores leave the round, for the agent's last message.
- The time estimate is computed: the words at 250 a minute, plus a minute per question or follow-up,
  rounded up to 5 minutes. Follow-ups are counted apart from questions.
- A point that depends on an answer is written into that option, not among the settled points.
- The notes are labelled "Anything else" on the page. The file keeps `**Notes:**`.
- Question titles take Astryx's level-1 heading size. Text in the round holds to about 75 characters
  a line.
- Options are Astryx selectable cards, which closes the raw button gap in `Question.tsx`.
- The inbox triage takes the new page and the writing rules.
- The skill's example round is rewritten in the new format.
- `clarifications.rs`, `RoundPage.tsx`, `Question.tsx`, and `SettledPoints.tsx` are split before
  they grow.
- Settled in the round, then overturned by your note: older rounds no longer stay valid. The
  [compatibility](../decisions/compatibility.md) decision replaces that point.

Settled while writing this spec:

- The block's verdict is its first item, starting "Verdict:", so that recording the answer keeps it.
  Its words are "worth building as proposed", "worth building, with changes", or "not as proposed".
- The four Context parts are required, and "Since the last round" is required in later rounds. The
  three settled groups are optional one by one, but every point sits in one.
- The writing warnings cover the block, the Context, the option sentences, and the settled points,
  for waiting rounds only. They skip quotes, tables, code, and links' text. The sentence limit is 25
  words, and the block's is 7 items.
- The settled groups' icons are Astryx's `warning`, `info`, and `wrench`. The look and feel pass may
  replace them.
- Whether "Under the hood" is open is kept in the URL's hash, as the page's other folds are.
- The 75-character measure applies to the round page and the triage, not to other pages: the specs
  redesign decides its own.
- A follow-up keeps its own entry in the question index, under its parent, as today.
- A change's round follows the same template, without the discovery link in Sources.
- `mermaid` is added to `packages/web` at 12.2.0, pinned. The mockups already use it.
- The fixture rounds in `fixtures/` are rewritten in the new format, and a fixture round in the new
  format serves Storybook's mockups.

## Decisions

New, applied when this spec is approved:

- [Diagrams](../decisions/diagrams.md): diagrams in workflow files are Mermaid code blocks, drawn on
  demand in a sandboxed frame, with `mermaid` pinned.
- [Compatibility](../decisions/compatibility.md): before 1.0, a format change keeps no old format
  working, and updates the templates, examples, fixtures, and default branch files with it.

Relied on:

- [Stack](../decisions/stack.md): the core owns the format, and the page draws the core's tree.
- [UI layout](../decisions/ui-layout.md): two width classes, 17 and 19 px text, text under 120
  characters. The two columns depend on the card's width, measured by a shared hook, not a media
  query.
- [UI components](../decisions/ui-components.md): Astryx `Card` and `SelectableCard`, StyleX with
  theme tokens.
- [UI checks](../decisions/ui-checks.md): browser tests at 402 × 874 and 1440 × 900, axe, and
  screenshots.
- [Preview](../decisions/preview.md): the mockups are stories over the fixture server.
- [Code quality](../decisions/code-quality.md): files at their limits are split first.

## Constitution check

| Principle                         | Complies | Notes                                                              |
| --------------------------------- | -------- | ------------------------------------------------------------------ |
| I. Humans stay in control         | yes      | the verdict and the pushback come before any question              |
| II. Git and plain text first      | yes      | a Mermaid diagram reads as text in any editor                      |
| III. Asynchronous by default      | yes      | nothing changes in how rounds are committed and answered           |
| IV. Review effort matches impact  | yes      | the opening and the settled groups put what you check first        |
| V. Tools are optional             | yes      | the warnings only measure rules the writing reference states       |
| VI. Code is checked, maintainable | yes      | files at their limits are split first, every scenario has its test |

## Risk tier

**Medium**: a format change to files agents and humans write, with no conversion, and a new
dependency on the web UI.

## Details

### Data

`RoundItems`, in [`items.rs`](/crates/core/src/files/items.rs), changes:

- `context: Vec<ContextPart>`, with
  `ContextPart { heading: usize, title: String, blocks: Vec<usize> }` in file order. Its `title` is
  the sub-heading's text. The triage has one part with no heading.
- `settled_groups: Vec<SettledGroup>`, with
  `SettledGroup { heading: usize, kind: SettledKind, blocks: Vec<usize> }`. `SettledKind` is
  `check`, `behaviour`, or `hood`, from the headings "Check these", "Behaviour", and "Under the
  hood". It replaces `settled`. `settled_points` is unchanged: subjects stay unique across groups.
- `QuestionItem.why: Option<usize>`: the paragraph starting "Why it matters", left out of `context`.
- `QuestionItem.applies`: `yes` or `no`. `unclear` is removed: a parent answered without a letter
  makes its follow-ups `no`.

Letters, in one function `letters(answer, options) -> Vec<char>`: option letters at the answer's
start, joined by `, `, `and`, or `, and `, and ended by `:`, `,`, `.`, or the end. Everything after
the letters and their end mark is the comment.

Check findings gain a severity: `error` or `warning`. `ura check` prints warnings after errors, as
`warning: <file>:<line>: <message>`, and exits 0 when it found only warnings. The language server
sends them with the Warning severity. The warnings run on files with `status: awaiting-human` only:

| Code               | When                                                   | Message                                       |
| ------------------ | ------------------------------------------------------ | --------------------------------------------- |
| `block.count`      | the first line's counts differ from the round's        | "the block says 1 follow-up, the round has 2" |
| `block.items`      | the block has more than 7 items                        | "the block has 8 items: keep at most 7"       |
| `writing.sentence` | a sentence over 25 words, outside quotes, tables, code | "a sentence of 31 words: split it at 25"      |

The new errors are `settled.group`, a point outside a group, and `sections.unknown` for a `###`
heading the template does not have, in Context or the settled points.

### Components

- **Writing reference** (`skills/uraeda/references/writing.md`, new): the numbered rules and their
  reasons. It covers the block's shape and limits, the Context's parts and what each holds,
  sentences of at most 25 words, terms defined at first use, never an ID from a file the reader has
  not seen, and never an answer cited by its number alone. It also covers context as long as the
  decision needs, with links to sources, quotes, tables when comparing, and diagrams for flows. Then
  the settled groups and their order, and the time estimate's formula.
- **Discovery** ([`references/discovery.md`](/skills/uraeda/references/discovery.md)): its
  questions-file sections link to the writing reference, and keep the asking rules. Follow-ups stay
  as today, under every option that needs one. The verdict comes from the discovery's "worth it and
  feasibility" findings.
- **Template and examples**: the
  [template](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/clarifications-01.md)
  holds the new sub-headings and bare placeholders. The
  [example round](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/clarifications-01.md)
  is rewritten, close to the mockup's round. The example change, `tasks-reappear`, gains a round
  waiting for the human.
- **Skill text**: [`SKILL.md`](/skills/uraeda/SKILL.md) links to the writing reference for the
  block, and drops the `-` rule. [`spec.md`](/skills/uraeda/references/spec.md),
  [`change.md`](/skills/uraeda/references/change.md),
  [`conventions.md`](/skills/uraeda/references/conventions.md) (Mermaid code blocks),
  [`finish.md`](/skills/uraeda/references/finish.md) (the record's sub-headings),
  [`inbox.md`](/skills/uraeda/references/inbox.md), and [`cli.md`](/skills/uraeda/references/cli.md)
  (warnings) follow.
- **Core round** ([`round.rs`](/crates/core/src/files/items/round.rs)): builds the parts, the
  groups, and `why`. It keeps sub-headings, where `section()` dropped them.
- **Core answers** ([`clarifications.rs`](/crates/core/src/files/clarifications.rs), split first):
  `letters()` replaces `picked_letters()` and `split_answer()`, and `applies()` loses `unclear`.
- **Core checks** ([`check/`](/crates/core/src/check/)): the severity, `settled.group`, the new
  `sections.unknown` cases, and a `writing` module that owns the limits and the three warnings.
- **`RoundPage`** ([`RoundPage.tsx`](/packages/web/src/RoundPage.tsx), split): the opening
  (`RoundOpening`), the cards (`QuestionCards`), and the end. The index stays beside the cards.
- **`QuestionCard`** (new, from [`Question.tsx`](/packages/web/src/Question.tsx)): an Astryx `Card`.
  Its header holds the id, or "Q1.B · follows Q1, because you picked B", and "Ask the agent". The
  title is at level-1 heading size, then the context, then "Why it matters" in a muted box. The
  options are `SelectableCard`s with the letter, "Recommended", the sentence, and +, −, ★ points.
  The comment is labelled "Comment, or your own answer instead of a letter". It is two columns, 5 to
  6, when the card is at least `--size-round-split` (840 px) wide and no option holds story
  variants, from a `useWidthOf` hook in `layout/`.
- **Follow-up cards**: after their parent's card, indented by `--spacing-6`, joined by a 4 px accent
  line. "Does not apply" is removed.
- **`SettledGroups`** (from [`SettledPoints.tsx`](/packages/web/src/SettledPoints.tsx)): a card with
  the heading "Settled without you", then each group with its icon and heading. "Under the hood" is
  folded behind "Show the N points", with "Fold" once open. Comments work as today.
- **Notes**: the field's label becomes "Anything else".
- **`Diagram`** (new, `packages/web/src/Diagram.tsx`): `Blocks` sends it every `code` block whose
  language is `mermaid`. It imports `mermaid` on demand, at `securityLevel: "sandbox"`, with the
  `neutral` or `dark` theme by colour mode. It gives the frame the title "Diagram" and lets it
  scroll sideways inside the card. On a parse error, it shows the source under "This diagram could
  not be drawn."
- **Theme** ([`theme.ts`](/packages/web/src/theme/theme.ts)): `--size-round-split: 840px` and
  `--size-round-measure: 75ch`.

### Error handling

- A round missing a Context part, or with a point outside a group: `ura check` fails, as for any
  missing section, and the web shows the round as it parses, with the problem in the feature's
  problems.
- A diagram that does not parse: the source shows under "This diagram could not be drawn.", and the
  rest of the page draws.
- `mermaid` fails to load, for example offline: the same fallback, with the same line.
- A save refused while the agent works: unchanged, "An agent is working on this feature. Stop it
  first, or wait for it."

### Testing

The core's tests read fixture rounds through `RoundItems` and `ura check`, table-driven for the
letters. The web's integration tests render the round page over the fixture server with the fake
agent, in happy-dom for behaviour, and in WebKit at 402 × 874 and 1440 × 900 for layout, diagrams,
and axe. Screenshots of the round page and the triage, at both sizes and in both themes, are
committed.

| What                                    | Test                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------- |
| US1.1, US1.2, US1.3, edge case on `###` | core check tests over fixture rounds                                    |
| US1.4, US1.5, US1.6                     | core check tests: warnings, and the CLI's exit code                     |
| US1.7                                   | core action test: submit keeps the verdict item                         |
| US1.8, SC-002, SC-005                   | core test checking the skill's example, the template, and every fixture |
| US2.1, US2.2, US2.3, US2.4              | web round test: parts and "Why it matters"                              |
| US3.1, US3.2, US3.3, SC-001             | browser round test: columns at both sizes                               |
| US3.4, US3.5, edge case "A and B"       | web round test: follow-up cards and the index                           |
| US3.6                                   | browser round test: keyboard on an option card                          |
| US4.1, US4.2, US4.3, US4.4              | web settled test: groups, fold in the URL, comments, "Anything else"    |
| US5.1, US5.2                            | web round test: the label, a comment alone closing the follow-up        |
| US5.3, US5.4, edge case "C but with"    | core table-driven test of `letters()`                                   |
| US6.1, US6.2, US6.4, edge case wide     | browser diagram test: the frame's sandbox, the fallback, the dark theme |
| US6.3, SC-003                           | browser test: a spec page requests no `mermaid` chunk                   |
| SC-004                                  | browser axe test of the round page, light and dark                      |
| Edge case: B to C                       | web round test: the card goes, the answer stays on disk                 |
| Edge case: answered round               | web round test: options are not tappable                                |
| Edge case: triage                       | web triage test: cards, free Context, no groups                         |
| Edge case: record at finish             | core finish test: the sub-headings' levels in the record                |
