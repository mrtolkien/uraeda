# Rulings: Redesign clarifications

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Warnings stay out of a feature's problems in the web UI and the steps

- **Decision**: `ura check` and the language server report warnings. `api::checked()`, which feeds
  the web UI's feature problems, keeps errors only, and nothing that decides a step reads a warning.
- **Rationale**: the spec says warnings "do not fail the check", and names the CLI and the language
  server as their readers ([Data](spec.md#data)). A feature's problems in the web UI stop its
  workflow and ask the human to fix files, which a writing warning must not do.
- **Alternatives considered**: showing warnings on the feature page: a new UI the spec does not ask
  for.
- **If wrong**: a filter to drop in `crates/core/src/api.rs`, and a view for the warnings.
- **Where**: task 5.

## R2: The sentence warning measures every prose block of a waiting round

- **Decision**: `writing.sentence` reads the block, the Context, the questions' context, the options
  and their bullets, and the settled points. It skips headings, quotes, tables, code, links' text,
  the answers, and the notes.
- **Rationale**: the spec's approval block reads the human's note as "the sentence-length warning
  you picked still applies everywhere, context included", while its assumptions list "the block, the
  Context, the option sentences, and the settled points". The approval block is the later and wider
  reading; the answers and notes are the human's, not the agent's.
- **Alternatives considered**: the assumptions' four parts only: a question's context, where long
  sentences grow, would go unmeasured.
- **If wrong**: one list of block kinds in `crates/core/src/check/writing.rs`.
- **Where**: task 5.

## R3: The block's counts are compared only when its first line gives them in digits

- **Decision**: `block.count` reads "N question(s)" and "N follow-up(s)" in the block's first
  paragraph. A first line without a count of questions in digits is not compared. A first line with
  questions and no follow-ups counts 0 follow-ups.
- **Rationale**: the writing reference asks for digits; reading number words would be a second rule
  for a case the reference rules out.
- **Alternatives considered**: warning on a first line with no count: a new limit the spec does not
  state.
- **If wrong**: one parser in `writing.rs`.
- **Where**: task 5.

## R4: The record's sub-headings are a rule of the finish reference, checked through a record

- **Decision**: the edge case "a round recorded at finish" is carried by
  [finish](/skills/uraeda/references/finish.md) and the record template, and tested by a core check
  test of a record holding `##### Goal` under `#### Context`.
- **Rationale**: the finish step is written by an agent: the core has no finish code to test.
- **Alternatives considered**: none that test anything more.
- **If wrong**: the reference's wording only.
- **Where**: tasks 3 and 6.

## R5: The mockup's round becomes a fixture file

- **Decision**: the round of `packages/web/.storybook/roundMockup.ts` moves to
  `fixtures/round-mockup/clarifications-01.md`, which the Storybook fixture reads and the core's
  fixture test checks.
- **Rationale**: the spec asks for "a fixture round in the new format" serving the mockups, and
  SC-002 checks every fixture round.
- **Alternatives considered**: keeping the text in TypeScript: `ura check` could not read it.
- **If wrong**: the file moves back into the Storybook fixture.
- **Where**: task 3.

## R6: The proposal's broken link is fixed

- **Decision**: the proposal's link `../redesign-specs.md` becomes `../drafts/redesign-specs.md`.
- **Rationale**: it fails `ura check` on this branch, which `vp run ready` runs. The discovery found
  it, and the human's wording stays as written.
- **Alternatives considered**: leaving it: `specs:check` stays red for the whole branch.
- **If wrong**: nothing: the folder becomes a record at finish.
- **Where**: task 3.

## R7: Unknown `###` headings are reported in rounds only

- **Decision**: `sections.unknown` reports a `###` heading under a level-2 section whose template
  children are all fixed headings in a round of questions only: its Context and its settled points.
  Other files keep today's rule, level-2 sections only.
- **Rationale**: the spec names the edge case for "Context or the settled points". Applied to every
  template, the rule also reached a discovery's "The code" and a spec's "Details", and failed this
  feature's own discovery, on two headings the discovery reference allows.
- **Alternatives considered**: the rule for every file, as the plan's step 3 first read: a format
  change to discoveries and specs that no spec asks for.
- **If wrong**: one condition in `check_unknown`, in `crates/core/src/check/sections.rs`.
- **Where**: task 3.

## R8: Two core tests follow the round's new data

- **Decision**: `a_round_has_its_questions_and_options` now expects "Why it matters" in Q1's `why`,
  out of its context, and `the_settled_section_ends_at_the_notes_and_takes_comments` reads the
  settled blocks from `settled_groups`, since `settled` is gone.
- **Rationale**: the spec's [Data](spec.md#data) moves "Why it matters" out of `context` and
  replaces `settled` with `settled_groups`. Both tests keep what they check: the context holds no
  answer, and the settled blocks stop before the notes.
- **Alternatives considered**: keeping `settled` beside the groups: a field the spec removes.
- **If wrong**: the two tests' assertions, in `crates/core/tests/items.rs`.
- **Where**: task 4.
