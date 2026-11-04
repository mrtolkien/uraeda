# Rulings: No limit of 6 user stories

The low-impact choices made while building [the proposal](proposal.md), inside the limits of the
decisions. None binds future work: those are decisions.

## R1: Only the split rule's limits go

- **Decision**: the split rule loses its three counts, 6 stories, 30 scenarios, and 2 changed
  decisions. The skill's other numbers stay, such as the block's 7 items, the spec's 2,000 words, a
  sentence's 25 words, a decision's 10 rules, and a scenario's 4 steps.
- **Rationale**: the proposal names the stories limit, and the split it triggers. The other numbers
  bound how long a file or a sentence is to read, not what a feature holds, and most have a lint in
  `ura check` (`block.items`, `spec.length`, `writing.sentence`, `decision.rules`): removing them
  changes the tool.
- **If wrong**: each other limit is its own rule in
  [Writing for the human](/skills/uraeda/references/writing.md) and its own lint, removed one at a
  time.
- **Where**: `skills/uraeda/references/writing.md`

## R2: Independent pieces stay in one feature

- **Decision**: the scope checks of discovery and the plan no longer split a proposal of several
  independent subsystems. A split needs one part whose build shapes the design of the next.
- **Rationale**: the proposal offers a split "only" for that reason. Independent pieces have none:
  their spec can describe them all at once.
- **If wrong**: the discovery's [scope check](/skills/uraeda/references/discovery.md#scope-check)
  gets back its sentence on independent subsystems.
- **Where**: `skills/uraeda/references/discovery.md`, `skills/uraeda/references/plan.md`
