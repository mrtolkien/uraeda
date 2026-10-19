# Rulings: Process message improvements

The low-impact choices made while planning and building [the plan](plan.md), inside the limits of
[the spec](spec.md) and the decisions. None binds future work: those are decisions.

## R1: Tasks 1 and 2 share one commit

- **Decision**: the tests of both tasks were written in one pass, and the code of both lands in one
  commit.
- **Rationale**: both tasks edit the same two files, and the old-text tests failed until both were
  built.
- **Alternatives considered**: two commits, by splitting the test file by hunks; not worth it for
  one small file.
- **If wrong**: a reviewer reads one commit instead of two.
- **Where**: tasks 1 and 2 of the plan.

## R2: The SIGTERM output test expects the output messages twice

- **Decision**: `test_exit_sigterm_output` asserts the messages are only the output text, not their
  count.
- **Rationale**: with output messages on, the live message and the final one at exit both show the
  output, as for any process today.
- **Alternatives considered**: asserting one message; it would pin behaviour this feature does not
  change.
- **If wrong**: none.
- **Where**: task 2.
