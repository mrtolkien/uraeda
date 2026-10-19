# Discovery, round 01: Process message improvements

## Summary

`GUIProcess` ([qutebrowser/misc/guiprocess.py](/qutebrowser/misc/guiprocess.py)) reports a finished
process with `ProcessOutcome` text plus the fixed suffix `See :process for details.`. `:process`
without a PID opens the last started process (`last_pid`), so the suffix can point at the wrong one.
A crash exit (`QProcess.CrashExit`) is shown as "crashed" with no signal, and a SIGTERM exit is an
error like any other crash. The proposal asks for the PID in the suffix, the signal name and number
in the text, and no message for SIGTERM unless `--verbose`. It is a small change in one file, with
its tests, the log entry and the changelog.

## How other products do it

Not researched: see [Not checked](#not-checked).

## Standards and libraries

### Python `signal` module

- `signal.Signals(11).name` returns `SIGSEGV` (run locally with Python in this session). An unknown
  number raises `ValueError`.

### QProcess exit codes

- For `CrashExit` on POSIX, `finished(exitCode, exitStatus)` carries the signal number as the exit
  code. The existing test `test_exit_crash` kills the child with `SIGSEGV`
  ([test](/tests/unit/misc/test_guiprocess.py)); the proposal's examples (status 11, status 15) rely
  on the same behaviour. On Windows the code of a crash is an exception code, not a signal (my
  judgement, unverified: no Windows machine here).

## The code

### Important reads

- [`guiprocess.py`](/qutebrowser/misc/guiprocess.py): `ProcessOutcome.__str__`, `state_str`,
  `was_successful`, and `GUIProcess._on_finished`, which builds the message with the fixed
  `" See :process for details."` suffix and logs stdout/stderr at error level for any non-successful
  exit. `self.pid` is set in `_post_start`.
- [`miscmodels.py`](/qutebrowser/completion/models/miscmodels.py) line 326: the `:process`
  completion sorts on `state_str() == 'successful'` and shows `state_str()`. A new `terminated`
  state appears there.
- [`editor.py`](/qutebrowser/misc/editor.py) line 117: uses `outcome.was_successful()`. The proposal
  keeps it false for SIGTERM, so the editor is unchanged.
- [`process.html`](/qutebrowser/html/process.html) line 15 renders `str(proc.outcome)`.
- [`tests/unit/misc/test_guiprocess.py`](/tests/unit/misc/test_guiprocess.py): tests with the old
  text are `test_start_verbose`, `test_exit_unsuccessful`, `test_exit_crash` and
  `test_exit_unsuccessful_output`.

### The proposal's path and existing actions

- Failure: `_on_finished` runs, shows `message.error(... See :process for details.)`; the user runs
  `:process`, which opens `last_pid`. Changes: the text carries `self.pid`.
- SIGTERM: today the same error path. Also `:process terminate` (the way a user sends SIGTERM) ends
  in an error message. Changes: no message, or an info message with `--verbose`.
- Cleanup: only a successful exit starts the 1h `_cleanup_timer`
  ([docs of `:process`](/qutebrowser/misc/guiprocess.py)). A SIGTERM exit is kept today.
- `_on_error` skips `Crashed` on POSIX, as `_on_finished` handles it.
- Output messages (`output_messages`) are emitted before the outcome message, so the outcome stays
  the last message.

### Rules and their owners

- Wording of the outcome: owned by `ProcessOutcome.__str__`; the suffix is the only copy, in
  `_on_finished`.

### Likely changes

- [`guiprocess.py`](/qutebrowser/misc/guiprocess.py): `ProcessOutcome` gets the signal text and
  `terminated`; `_on_finished` gets the PID suffix and the SIGTERM branch.
- [`test_guiprocess.py`](/tests/unit/misc/test_guiprocess.py): update four tests, add SIGTERM and
  signal-name tests.
- [`doc/changelog.asciidoc`](/doc/changelog.asciidoc): an entry.

## The proposal

### Repeated requirements

The Requirements list several bullets twice (verbose success, failure, signal text, `state_str`,
SIGTERM). They agree with each other, apart from the signal text, written once with `{What}` and
once with `{process}`; both mean the capitalized label ("Testprocess ..."). No conflict.

### Windows and unknown signal numbers

The proposal gives the format `{What} {state} with status {code} ({signal_name})` and no fallback
when the code is not a known signal, which happens for Windows crash codes.

### The constraint on outside sources

The proposal says not to look up existing solutions, external PRs, or online workarounds.

## Worth it and feasibility

Small and cheap: one file, no dependency. It relies on Qt reporting the signal number as the crash
exit code: checked only through the existing test, and the plan's first task runs a SIGTERM test to
verify it. No security guard is relaxed.

## Approaches

Criteria come from the [proposal](proposal.md) and the [constitution](/specs/CONSTITUTION.md): keep
every requirement as written, add nothing the proposal does not ask for.

### Scope

The proposal is one small feature.

| Option                  | Requirements met | Extra work |
| ----------------------- | ---------------- | ---------- |
| A. Do the proposal only | all              | none       |

### Needs no choice

- Unknown signal number: print the status without the name (see questions, settled points).
- SIGTERM and the cleanup timer and error logs: see questions, settled points.

## Not checked

- How other products word these messages, and Qt's online documentation: the proposal forbids
  looking up existing solutions and online workarounds, so no web search was done.
- Windows crash exit codes: no Windows machine here.
