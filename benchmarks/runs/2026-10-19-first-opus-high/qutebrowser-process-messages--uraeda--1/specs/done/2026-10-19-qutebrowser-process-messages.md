---
kind: feature
finished: 2026-10-19
---

# Record: Process messages

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-10-19, finished on
> 2026-10-19, on the branch `2026-10-19-qutebrowser-process-messages`. Its full files are in git:
> `git log -- specs/2026-10-19-qutebrowser-process-messages/`.

## What and why

When a process started by qutebrowser finishes (`:spawn`, userscripts, the external editor, file
pickers), its message used to point to `:process` without a PID, which opens the last _started_
process, maybe not the one that failed. A stop with SIGTERM, for example by
`:process <pid> terminate`, showed an error, and a process killed by a signal only said "crashed".
The proposal asked for the right PID, quiet SIGTERM stops unless `--verbose`, and the signal's name.

## Behaviour

- Every outcome message ends with `See :process <pid> for details.`, with the PID of the process
  that finished: `Command exited with status 1. See :process 1234 for details.` A success shows it
  as an info with `--verbose` only, as before.
- A crash names its signal: `Command crashed with status 11 (SIGSEGV).`, and its state in the
  `:process` completion stays `crashed`. A code that is no known signal, and every crash on Windows,
  leaves out the parenthesis: `Command crashed with status -1.`
- A crash by SIGTERM reads `Command terminated with status 15 (SIGTERM).`, with the state
  `terminated`. Without `--verbose` it shows no outcome message at all; with it, an info, never an
  error. `was_successful()` stays false: its output is still logged at error level, and its data is
  kept until qutebrowser quits, not cleaned up after 1 hour. Output messages from `:spawn -m` still
  show, stderr as an error.
- `:process <pid> kill` (SIGKILL) stays an error, naming `SIGKILL`. A shell exiting normally with
  143, or a process with 15, is a failure like any non-zero exit.
- The external editor stopped with SIGTERM shows no error, and still keeps its temporary file with
  its info.
- The hint for long output, `[N lines hidden, see :process for the full output]`, is unchanged.

## Design

Everything lives in [`guiprocess.py`](/qutebrowser/misc/guiprocess.py), with no public function,
class, or method added.

- `_is_sigterm(outcome)`, private to the module, owns the SIGTERM rule: a `CrashExit` with code
  `signal.SIGTERM`. Qt gives the signal number as the code of a `CrashExit` on Linux, checked by the
  tests that kill real children.
- `ProcessOutcome.__str__` and `state_str()` own the outcome text and the short state, the signal
  name from `signal.Signals`.
- `GUIProcess._on_finished` owns the message and its pointer. Output logging and the cleanup timer
  still follow `was_successful()` alone.

The `:process` completion and the `qute://process` page show the new texts without a change.

## Questions

### Round 01

#### Q1: Besides the message, what does a SIGTERM stop share with a successful exit?

**Answer:** A, "your call": only the message changes; the output is still logged at error level and
the data stays until qutebrowser quits.

#### Q2: Should a kill with SIGKILL stay an error?

**Answer:** A: keep the error for SIGKILL, only SIGTERM is quiet.

#### Q3: Should the hint for long output also name the PID?

**Answer:** A, "your call": leave the hint as it is, and note it in the inbox for a later change.

#### Q4: Should the project record its code-quality limits as a decision?

**Answer:** A, "your call": record the limits pylint and flake8 already set, without changing their
configuration.

#### Notes

The human's notes restated the task: the proposal's requirements, and the constraint that the
implementation be independent work, without looking up existing solutions.

## Decisions

- [Code quality](../decisions/code-quality.md): lines within 190 characters, functions within 10
  arguments and a complexity of 12, as pylint and flake8 check.

## Changes after approval

- A crash on Windows never names a signal: Python names 0 and 1 there `CTRL_C_EVENT` and
  `CTRL_BREAK_EVENT`, which are no crash signals. Found by the final review.

## Follow-ups

- The hint for long output names no PID, so it can open the wrong process.
- `test_exit_unsuccessful_other_process_started` kills its second process only at the end of the
  test body.
- `ProcessOutcome.__str__` takes its word from `state_str()`, so renaming a completion state would
  change the messages.
- `GUIProcess._on_finished` tests `was_successful()` twice.
- `test_exit_sigterm_verbose` does not check that the cleanup timer stays stopped.
- Unverified here: Qt's crash code on macOS, mypy, `tox -e pylint`, and the end-to-end features; CI
  runs them.
