# Rulings: Spec comments: suggestion vs change needed

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
decisions. None binds future work: those are decisions.

## R1: One line under the verdict, only once there is a comment

- **Decision**: once a review has a comment, one supporting line under the verdict's buttons says
  what each does with it: "With comments, Approve leaves them to the plan; Request changes revises
  the spec first." A plan's says "the implementation" and "the plan". Nothing shows before the first
  comment, and neither button is held back or confirmed.
- **Rationale**: the proposal asks for the human to understand when to request a revision, "but
  don't be too ham-fisted about it". The line appears at the moment of the choice, states what each
  button does rather than warning, and sits where "Request changes: Add a comment first" already
  does. The skill already accepts either verdict with comments: the plan carries out an approved
  spec's, in its `## Review comments`.
- **Alternatives considered**: a confirmation dialog on approving with line comments, which adds a
  step to every such approval; a line shown at all times, which repeats itself on reviews with no
  comment.
- **Where**: [`ReviewVerdict`](/packages/web/src/ReviewVerdict.tsx)
