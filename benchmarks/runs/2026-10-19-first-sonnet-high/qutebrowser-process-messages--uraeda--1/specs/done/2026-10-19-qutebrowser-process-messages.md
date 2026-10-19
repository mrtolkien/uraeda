---
kind: feature
finished: 2026-10-19
---

# Record: Process message improvements

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19, in a pull request on branch `2026-10-19-qutebrowser-process-messages` (no forge CLI
> was available to open it). Its full files are in git:
> `git log -- specs/2026-10-19-qutebrowser-process-messages/`.

## What and why

When a qutebrowser process failed or was killed, the message ended with `See :process for details.`,
and `:process` opens the last started process, which may not be the failing one. A crash showed no
signal, and a SIGTERM was reported as an error. Users who spawn processes, run userscripts or use an
editor now get the right PID, the signal name, and no error for SIGTERM.

## Behaviour

- Every finished-process message ends with `See :process {pid} for details.` with the process's own
  PID.
- A crash reads `{What} crashed with status {code} ({signal_name}).`; an unknown code reads
  `{What} crashed with status {code}.`
- A SIGTERM exit reads `{What} terminated with status 15 (SIGTERM).`, `state_str()` is `terminated`,
  and `was_successful()` stays false.
- A SIGTERM exit emits nothing without `--verbose`, an info message with it, starts no 1h cleanup,
  and does not log stdout and stderr at error level.

## Design

The change stays in [`guiprocess.py`](/qutebrowser/misc/guiprocess.py). `ProcessOutcome` owns the
text and state names (`was_sigterm()`, `__str__`, `state_str()`), using `signal.Signals`.
`GUIProcess._on_finished` owns the PID suffix and the SIGTERM branch. Qt reporting the signal number
as the crash exit code was verified by a real SIGTERM test. On Windows a crash code of 15 would be
read as SIGTERM.

## Questions

### Round 01

#### Q1: Go ahead with this scope?

**Answer:** A. Go ahead with the scope.
