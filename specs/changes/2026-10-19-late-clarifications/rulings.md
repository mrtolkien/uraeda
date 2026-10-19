# Rulings: Clarifications during implementation can resume implementation

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
answered [round](clarifications-01.md) and the decisions. None binds future work: those are
decisions.

## R1: The key counts only while the implementation is under way

- **Decision**: the step finder honours `resumes: implementation` only when the feature is being
  built: spec approved, plan approved with an unchecked step.
- **Rationale**: a hand-edited key on a feature with no plan, or a finished one, would otherwise
  stall it or skip the answers. The submit paths refuse it there too.
- **Alternatives considered**: trusting the key anywhere, and a `ura check` warning: both leave the
  feature stuck until someone notices.
- **If wrong**: the round goes to the spec step, as before the key existed.
- **Where**: [`feature_step`](/crates/core/src/steps.rs).

## R2: A submit without resuming removes the key

- **Decision**: submitting a round the ordinary way deletes a `resumes` left in it.
- **Rationale**: a round reopened by hand and answered with "Answer and revise the spec" must not
  keep the earlier choice.
- **Alternatives considered**: leaving the file as found: it overrules the human's later click.
- **If wrong**: a human sets the key by hand again.
- **Where**: [`record`](/crates/core/src/actions/answer.rs).

## R3: The notes' format moved out of SKILL.md

- **Decision**: the rule for comments on settled points moved from `SKILL.md` to
  [Writing for the human](/skills/uraeda/references/writing.md#the-notes).
- **Rationale**: `SKILL.md` was already over its 20,000-character limit before this change, and the
  step table needed a longer row. The test `the_skill_entry_point_stays_lean` fails otherwise.
- **Alternatives considered**: leaving it over the limit, with a failing test.
- **If wrong**: move the paragraph back, and trim elsewhere.
- **Where**: `SKILL.md`, `writing.md`.
