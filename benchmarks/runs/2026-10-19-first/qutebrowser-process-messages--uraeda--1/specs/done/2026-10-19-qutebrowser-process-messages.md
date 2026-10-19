---
kind: feature
finished: 2026-10-19
---

# Record: Process messages

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19. No pull request could be opened from this environment (no `gh`): the branch is pushed.
> Its full files are in git: `git log -- specs/2026-10-19-qutebrowser-process-messages/`.

## What and why

When a process spawned by qutebrowser fails, its message named the last process rather than the
failing one, a SIGTERM exit showed an error, and a crash gave no signal. This fixes all three for
anyone using `:spawn`, an editor, or a userscript.

## Behaviour

- A failure or verbose message ends in `See :process <pid> for details.` with the finished process's
  own PID; the failure text is also the last process-log entry.
- A SIGTERM exit emits nothing without `--verbose`, and only an info message with it; it still
  counts as unsuccessful (`was_successful()` is false), is cleaned up after 1 hour, and its state
  reads `terminated`.
- A signal exit reads `<What> crashed with status <n> (<SIGNAME>).`; a code Python cannot name keeps
  `<What> crashed.`

## Design

All in [`guiprocess.py`](/qutebrowser/misc/guiprocess.py). `ProcessOutcome` derives the signal from
the exit code of a `CrashExit` and owns the text and state; `GUIProcess._on_finished` owns the
suffix and the message choice. Qt reports the signal number as the exit code on Unix, checked by
`test_exit_signal_code`.

## Questions

### Round 01

#### Q1: Do you confirm the scope below?

**Answer:** A, exactly the proposal's requirements, nothing beyond.

## Changes after approval

None.
