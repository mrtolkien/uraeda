---
status: answered
---

# Clarifications, round 01: Process message improvements

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building as proposed, a small change in one file.
> - SIGTERM exits: I left their cleanup after 1h and their error log as they would be for a success
>   or a failure, see the settled points.
> - Unknown signal numbers: I print the status without a name, see the settled points.
> - No web research was done, because the proposal forbids looking up existing solutions.

## Context

### Goal

Failed or killed processes should show the right PID, the signal name, and no error for SIGTERM
unless `--verbose`.

### Today

[`GUIProcess._on_finished`](/qutebrowser/misc/guiprocess.py) shows `... See :process for details.`
and `:process` opens the last started process, not the failing one. A crash is shown as "crashed"
with no signal, and a SIGTERM is an error.

### Scope

The messages of `GUIProcess` and `ProcessOutcome.state_str()`, with their tests and a changelog
entry. Nothing else.

### Sources

- The code of [`guiprocess.py`](/qutebrowser/misc/guiprocess.py) and its tests. The full
  investigation is in [discovery](discovery-01.md).

## Q1: Go ahead with this scope?

The proposal is one small change. It also repeats several requirements, which agree with each other.
More in [discovery](discovery-01.md#scope).

Why it matters: it confirms nothing is missing or extra before the spec is written.

- **A (recommended). Go ahead with the scope above.**
  - [pro] it matches the proposal exactly.
  - [con] none.
  - Why recommended: the proposal is complete and small.
- **B. Change the scope: say what to add or remove in your answer.**
  - [pro] you decide.
  - [con] a further round may be needed.

**Answer:** A. Go ahead with the scope.

## Settled without the human

### Check these

- **SIGTERM and the cleanup timer** stays as today: only a successful exit starts the 1h cleanup,
  because the proposal says "only for GUI messaging". See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **SIGTERM and the error log** is skipped: a SIGTERM exit does not log the process's stdout and
  stderr at error level, so it emits nothing at error level at all.

### Behaviour

- **An unknown signal number** (for example a Windows crash code) is shown as
  `{What} crashed with status {code}.`, without a name. See
  [discovery](discovery-01.md#windows-and-unknown-signal-numbers).
- **The `:process` completion** shows `terminated` for a SIGTERM exit, as `state_str()` requires.

### Under the hood

- **Changelog**: an entry under Changed, following the repository's practice.
- **Tests**: the four existing tests are updated to the new text, with new tests for SIGTERM, with
  and without `--verbose`, and for the signal names.
- **Web research** was skipped, as the proposal forbids it. See
  [discovery](discovery-01.md#not-checked).

**Notes:**
