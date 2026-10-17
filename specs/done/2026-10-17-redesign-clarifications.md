---
kind: feature
finished: 2026-10-17
pull-request: https://github.com/mrtolkien/uraeda/pull/30
---

# Record: Redesign clarifications

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-17, finished on
> 2026-10-17, in [its pull request](https://github.com/mrtolkien/uraeda/pull/30). Its full files are
> in git: `git log -- specs/2026-10-17-redesign-clarifications/`.

## What and why

Rounds of questions had grown to 1.5 times the skill's example, opened by retelling the proposal,
and read as a flat list on the page. The human asked for a round that is quick to read once, top to
bottom: a verdict on the proposal and typed facts first, each question as a card with room for
context, follow-ups set apart, settled points grouped by what to check, answers with a comment and
no letter, and wording every model follows the same way.

## Behaviour

- **The format.** A round's block opens with the counts and the time, then a "Verdict:" item, with
  at most 7 items. `## Context` holds `### Goal`, `### Today`, `### Scope`, and `### Sources`, with
  `### Since the last round` first from round 02 on. Each question has a "Why it matters" paragraph.
  `## Settled without the human` holds `### Check these`, `### Behaviour`, and `### Under the hood`,
  each optional, every point in one. The inbox triage keeps a free Context and no groups.
- **`ura check`** refuses a missing part (`sections.missing`), an unknown `###` in a round's Context
  or settled points (`sections.unknown`, rounds only), and a point outside a group
  (`settled.group`). On waiting rounds and triages, it warns: `block.count` when the first line's
  counts differ from the round's, `block.items` past 7 items, and `writing.sentence` past 25 words,
  outside headings, quotes, tables, code, links' text, answers, and notes. Warnings print after
  errors, as `warning: <file>:<line>: <message>`, exit 0, reach editors as Warning diagnostics, and
  never stop a step or show as a feature's problem in the web UI.
- **Letters.** An answer's letters are the longest run of option letters at its start, joined by
  `, `, `and`, or `, and `, followed by `:`, `,`, `.`, or the end; the rest is the comment. "B,
  let's not" picks B; "C but with napi-rs" and "A and B are both bad" pick nothing. A question
  answered without a letter closes its follow-ups: the `-` answer and "Does not apply" are gone.
- **The page.** The opening draws the block, then each Context part under its heading, held to about
  75 characters a line. Each question is an Astryx card with a level-1 title; from a card width of
  840 px, measured over the question and its follow-ups, it splits 5 to 6, title and context left,
  options and comment right, unless an option holds story variants. "Why it matters" sits in a muted
  box after the context. Options are selectable cards, named by their letter and sentence. A
  follow-up is its own card after its parent's, headed "Q1.B · follows Q1, because you picked B",
  indented and joined by an accent line, in letter order. On the phone, questions have no card,
  bands separate them, options run to the screen's edges, and the title sticks below the top bar.
  The comment field reads "Comment, or your own answer instead of a letter".
- **Settled points** show under "Settled without you", in a card on wide screens, each group with
  its icon; "Under the hood" starts folded behind "Show the N points", its state kept in the history
  entry. Comments on points work in every group. The notes field reads "Anything else"; the file
  keeps `**Notes:**`.
- **Tables**, on every page, keep columns of at least 144 px, and scroll sideways in their own
  region; the page never does.
- **Diagrams.** A `mermaid` code block draws as a diagram, with `mermaid` 12.2.0 loaded only by
  pages that hold one, at Mermaid's `sandbox` level, shown in a frame titled "Diagram" without
  scripts or the app's origin, with the `dark` or `neutral` theme by colour mode. A diagram that
  does not draw shows its source under "This diagram could not be drawn.". A wide diagram scrolls in
  a keyboard-reachable region.

## Design

The core owns the format. [`letters.rs`](/crates/core/src/files/clarifications/letters.rs) reads an
answer's letters for the follow-ups, the page, and `ura check`.
[`round.rs`](/crates/core/src/files/items/round.rs) sends `RoundItems` with `ContextPart`s,
`SettledGroup`s, and each question's `why`. [`sections.rs`](/crates/core/src/check/sections.rs)
takes the required parts from the embedded template;
[`writing.rs`](/crates/core/src/check/writing.rs) owns the limits and the warnings; a `Problem` has
a `Severity`. The skill's [writing reference](/skills/uraeda/references/writing.md) is the one home
of the writing rules, linked from discovery, the skill, and the other references. The web UI splits
the round page into [`RoundOpening`](/packages/web/src/RoundOpening.tsx),
[`QuestionCards`](/packages/web/src/QuestionCards.tsx) and
[`QuestionCard`](/packages/web/src/QuestionCard.tsx), with
[`useWidthOf`](/packages/web/src/layout/useWidthOf.ts), and
[`SettledGroups`](/packages/web/src/SettledGroups.tsx);
[`BlockTable`](/packages/web/src/BlockTable.tsx) and [`Diagram`](/packages/web/src/Diagram.tsx) draw
tables and diagrams for every page.

## Questions

### Round 01

#### Q1: Does the session in a side column belong to this feature?

**Answer:** A: the format and page here, the side column later, with the specs redesign ("Put it in
later").

#### Q2: What opens the round?

**Answer:** A: the block is the verdict and its pushback.

#### Q3: Which parts follow the block, and how are they marked?

**Answer:** A: Goal, Today, Scope, Sources, and Since the last round, under `###` sub-headings.

#### Q4: How are the settled points grouped?

**Answer:** A: "Check these", "Behaviour", "Under the hood", under sub-headings, "separated
visually, with icons".

#### Q5: How does the skill make every model write the same round?

**Answer:** A and B: a writing reference with a skeleton template and filled examples, and
`ura check` warnings for measured limits.

#### Q6: How does a question's card use a wide screen?

**Answer:** A: two columns, the question and its context left, the options and the comment right;
one column on a narrower card or with story variants.

#### Q7: How does a follow-up show once its option is picked?

**Answer:** A: its own card after its parent's, joined by a line.

#### Q8: When does the agent write a follow-up?

**Answer:** B: under every option that needs one, as before.

#### Q9: How are a question's context and options written?

**Answer:** A, without its limit: "I want MORE context if anything, do not limit it".

#### Q10: Can a round hold a diagram?

**Answer:** B: Mermaid, rendered now, since "a round could ask to pick between multiple flows".

#### Notes

- Older rounds staying valid was dropped: no backward compatibility before 1.0, written down as a
  decision.

## Decisions

- [Diagrams](../decisions/diagrams.md): Mermaid code blocks, drawn on demand in a sandboxed frame,
  with `mermaid` pinned.
- [Compatibility](../decisions/compatibility.md): before 1.0, a format change keeps no old format
  working, and the agent that meets an old-format file rewrites it.

## Changes after approval

- Warnings never reach a feature's problems in the web UI, nor stop a step: only `ura check` and
  editors show them.
- The sentence warning measures every prose block of a waiting round, a question's context included,
  as the spec's approval note asked; headings, quotes, tables, code, links' text, answers, and notes
  are skipped.
- The block's counts are compared only when its first line gives them in digits.
- Unknown `###` headings are refused in rounds only, not in specs or discoveries.
- A question's follow-ups take its columns: the width is measured over the question and its
  follow-ups, since an indented follow-up's card falls under 840 px.
- "Under the hood" open is kept in the history entry, as the page's other folds are, rather than in
  the URL's hash: it survives a reload and Back.
- Option cards are named by their letter and sentence, for screen readers; a diagram wider than its
  card scrolls in a keyboard-reachable region; quoted headings start no part or group.
- The skill's follow-up rule gives each option that needs a follow-up its own (`Q1.B`, `Q1.C`),
  never one shared by two letters, which the core never showed for the second.

## Follow-ups

- Mermaid draws each diagram first in a temporary frame of the app's origin that runs scripts, so a
  sanitiser bypass would reach the app, against the [diagrams](../decisions/diagrams.md) decision's
  intent. Running it in an opaque-origin frame needs that decision amended (Mermaid's `strict`
  level, since WebKit gives such frames no child `contentDocument`) and the server's guard to allow
  `Origin: null` reads of `/assets/*`.
- The minor findings of the reviews, under **Deferred fixes** in the inbox: the "Show the 1 points"
  label, `block.count` on a round sent back for blank answers, comment-only answers that start like
  a letter, the diagram frame's details, old-format rounds left as inline test inputs, and
  `specs/backlog/benchmarks/clarifications-01.md`'s long sentences and shared follow-ups.
