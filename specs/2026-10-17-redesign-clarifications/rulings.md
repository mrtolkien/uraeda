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

## R9: Letters end only at an end mark

- **Decision**: an answer's letters are the longest run of joined letters followed by an end mark or
  the end; when no run is, the whole answer is the comment. "B, C and D" with options A to C is B,
  with the comment "C and D", and "A and B are both bad" has no letter. The test's row for "B, C and
  D" and review focus 2 now say so.
- **Rationale**: the plan's row, B and C with the comment "and D", contradicted the spec's rule in
  the plan's Global constraints: letters are ended by `:`, `,`, `.`, or the end, and everything
  after the letters and their end mark is the comment. Reading "and" as an end made "A and B are
  both bad" pick A.
- **Alternatives considered**: keeping " and <word>" as an end for "B, C and D" alone: no rule tells
  it apart from "A and B are both bad".
- **If wrong**: `read` in `crates/core/src/files/clarifications/letters.rs`, and the table in
  `crates/core/tests/items.rs`.
- **Where**: the review fix after task 4.

## R10: The web UI fixture round gives its true counts

- **Decision**: the block of `fixtures/repo/branches/2026-10-11-web-ui/.../clarifications-01.md` now
  opens "3 questions and 1 follow-up on the web UI, about 35 minutes.", and the home page's test in
  `packages/web/src/__tests__/home.test.tsx` expects that line.
- **Rationale**: the round holds 3 questions and 1 follow-up, while its block said 11 questions.
  SC-002 asks every fixture round to pass with no warning, and `block.count` flags the old line. The
  test asserted the fixture's text, which the new warning shows was wrong.
- **Alternatives considered**: leaving the fixture out of the SC-002 test: the spec names every
  fixture round.
- **If wrong**: the fixture's first line and the test's expected text.
- **Where**: task 5.

## R11: Which fixture rounds SC-002 checks, and how

- **Decision**: `every_fixture_round_passes` in `crates/core/tests/check.rs` checks the example, the
  round and triage templates, the triage fixture, the mockup round, `fixtures/settled-comments`, the
  preview's round, and the four rounds of `fixtures/repo/branches/`. Those four are checked in
  place, without their `links.file` problems: their fixture repository lacks the discovery, the
  priorities, and the constitution they link to. The rounds of `fixtures/specs/` are stubs for the
  workspace's tests, and `fixtures/broken/` is broken on purpose: neither is checked.
- **Rationale**: SC-002 says "every fixture round"; the stubs and the broken files are not rounds an
  agent writes, and the branch copies' missing targets belong to their fixture repository, not to
  the round format.
- **Alternatives considered**: copying the branch rounds into the example: they are copies of an
  older example round, and their checks would read the example's files instead of theirs.
- **If wrong**: the test's list and its filter.
- **Where**: task 5.

## R12: The templates' and fixtures' long sentences are split

- **Decision**: the sentences over 25 words in the round and triage templates' placeholders, the
  triage fixture, the mockup round, and the web UI round are rewritten under the limit, their
  meaning kept. The triage fixture's three quoted notes become a list.
- **Rationale**: SC-002: the templates and every fixture round pass with no warning.
- **Alternatives considered**: skipping placeholders in brackets: a rule for templates only.
- **If wrong**: the wording of those lines.
- **Where**: task 5.

## R13: The web UI's "Does not apply" save leaves the actions test

- **Decision**: the step labelled US2.7 in `saves_answers_as_the_ui_composes_them`, in
  `crates/core/tests/actions.rs`, which saved `-` on a follow-up, is removed.
- **Rationale**: it checked the web UI's "Does not apply" button, US2.7 of the
  [web UI's record](../done/2026-10-11-web-ui.md), which writes `-`. The spec removes the button and
  the skill's `-` answer: a parent answered without a letter closes its follow-ups. Saving a comment
  stays checked by the test's other steps.
- **Alternatives considered**: relabelling it as a comment saved on a follow-up: it would keep `-`
  as the example of an answer that no longer means anything.
- **If wrong**: the three lines come back, with a comment other than `-`.
- **Where**: task 6.

## R14: The Neovim hint of the example change follows its waiting round

- **Decision**: `priorities show their hints`, in `editors/nvim/tests/test_inline.lua`, expects the
  example change's hint to read "human-gate · waits on you" instead of "change · waits on agent".
- **Rationale**: the spec gives the example change a round waiting for the human
  ([Template and examples](spec.md#components)), so its step is a human gate. The test reads the
  example as it is.
- **Alternatives considered**: removing the round from the test's copy of the example: the test
  would check a state the example no longer shows.
- **If wrong**: the expected hint, or the test's copy of the example.
- **Where**: task 6.
