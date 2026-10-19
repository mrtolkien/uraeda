# Discovery, round 01: Process messages

## Summary

qutebrowser runs external programs (`:spawn`, userscripts, the external editor, file pickers)
through [`GUIProcess`](/qutebrowser/misc/guiprocess.py), a wrapper around Qt's `QProcess`. When one
finishes, it shows a message: an error when it failed, an info when it succeeded and `--verbose` was
given. Three problems are named in the [proposal](proposal.md):

- the error points to `:process` without a PID, and `:process` alone opens the _last started_
  process, not the one that failed;
- a process stopped with SIGTERM, for example by `:process <pid> terminate`, shows an error;
- a process killed by a signal only says "crashed", without the signal.

Tools that run processes differ mostly on whether a SIGTERM exit counts as an error: systemd and
bash treat it as a normal stop, Python's `subprocess` reports it like any other signal. The proposal
picks the first group for messages only, and keeps `was_successful()` false. What it leaves open is
everything a "successful exit" also triggers in the code besides the message: the error-level log of
the output, and the 1-hour cleanup of the process data.

## How other products do it

The task forbids looking up existing solutions to this change, so this section compares
general-purpose tools that run processes, not qutebrowser's own history or other browsers' code.

### systemd

- A service stopped by SIGHUP, SIGINT, SIGTERM, or SIGPIPE counts as a clean exit by default, except
  for `Type=oneshot`
  ([systemd.service, `SuccessExitStatus=`](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html)).
- SIGKILL is not in that list: a killed service is a failure.

### bash

- Experiment run in this session (bash, Linux): a background job killed with SIGTERM and waited for
  prints nothing, and `$?` is `143` (128 + 15). A child killed by SIGSEGV prints
  `Segmentation fault (core dumped)`, `$?` is `139`.
- So bash names the signal for crashes, and stays silent for a requested stop.

### Python's subprocess

- Experiment run in this session (Python 3.10): `subprocess.run(..., check=True)` on a child killed
  by SIGTERM raises `CalledProcessError`, whose text is
  `Command '[...]' died with <Signals.SIGTERM: 15>.`
- Python treats SIGTERM like any other signal, and names it.

### What they have in common

- A signal death is reported with the signal's name, not only its number.
- A requested stop (SIGTERM) is quiet in tools meant for interactive users or services; an
  unexpected one (SIGSEGV, SIGABRT) is loud.
- SIGKILL is a failure everywhere: it is also what the kernel's out-of-memory killer sends, so the
  tool cannot tell a user's kill from a forced one.
- A message refers to the process it is about, by its PID or name.

## Standards and libraries

### Qt's QProcess (Qt 6.5.1, PyQt6 6.5.0 installed)

- `exitCode()` "is not valid unless `exitStatus()` returns `NormalExit`"
  ([QProcess](https://doc.qt.io/qt-6/qprocess.html#exitCode)). On a crash, the number is
  undocumented.
- `terminate()` sends SIGTERM on Unix and macOS. On Windows it posts `WM_CLOSE`, and console
  programs without an event loop "can only be terminated by calling `kill()`"
  ([QProcess::terminate](https://doc.qt.io/qt-6/qprocess.html#terminate)).
- `kill()` sends SIGKILL on Unix and macOS, and calls `TerminateProcess` on Windows
  ([QProcess::kill](https://doc.qt.io/qt-6/qprocess.html#kill)).
- On Windows, a process ended by `TerminateProcess` has `NormalExit` "unless the exit code is less
  than 0" ([QProcess::exitStatus](https://doc.qt.io/qt-6/qprocess.html#exitStatus)).

### What Qt does on a signal, checked

Experiment run in this session, outside the repository, with the installed PyQt6 on Linux:

| How the child ended         | `errorOccurred` | `finished(code, status)` |
| --------------------------- | --------------- | ------------------------ |
| `QProcess.terminate()`      | `Crashed`       | `15, CrashExit`          |
| `QProcess.kill()`           | `Crashed`       | `9, CrashExit`           |
| child sends itself SIGSEGV  | `Crashed`       | `11, CrashExit`          |
| child sends itself SIGTERM  | `Crashed`       | `15, CrashExit`          |
| child sends itself SIGINT   | `Crashed`       | `2, CrashExit`           |
| child calls `sys.exit(143)` | none            | `143, NormalExit`        |

- On Linux, the code of a `CrashExit` is the signal number. This is Qt's behaviour, not its
  documented contract, so the tests that cover it double as a check.
- A SIGTERM from `terminate()` and one from elsewhere (a shell's `kill`, system shutdown) look the
  same: qutebrowser cannot tell who sent it.
- A shell that exits with `143` after its child got SIGTERM is a `NormalExit`: it stays a failure.

### Python's signal module (3.10)

- `signal.Signals` is an `IntEnum` of the signal constants
  ([signal](https://docs.python.org/3.10/library/signal.html#module-contents)). Experiment:
  `signal.Signals(15).name` is `SIGTERM`, `signal.Signals(11).name` is `SIGSEGV`, and
  `signal.Signals(200)` raises `ValueError`.
- "Not all systems define the same set of signal names". On Windows, only `SIGABRT`, `SIGFPE`,
  `SIGILL`, `SIGINT`, `SIGSEGV`, `SIGTERM`, and `SIGBREAK` exist
  ([signal](https://docs.python.org/3.10/library/signal.html#signal.signal)).
- `signal.strsignal()` gives the description ("Segmentation fault"), not the name, and `None` for an
  unknown signal.

## The code

### Important reads

- [`guiprocess.py`](/qutebrowser/misc/guiprocess.py): `ProcessOutcome` builds the outcome text
  (`__str__`) and the short state (`state_str()`). `GUIProcess._on_finished` decides the message:
  info with the bare outcome when successful and verbose, else error with
  `" See :process for details."`. It also logs stdout and stderr at error level on failure, and
  starts the 1-hour cleanup timer on success only. The file is about 400 lines, `_on_finished` about
  35: no limit in the way.
- [`process()` in the same file](/qutebrowser/misc/guiprocess.py): `:process` without a PID opens
  `last_pid`, the last _started_ process. Its docstring says "processes with a successful exit get
  cleaned up after 1h".
- [`GUIProcess._on_error`](/qutebrowser/misc/guiprocess.py): ignores `Crashed` on non-Windows, since
  `_on_finished` handles it. On Windows it still shows "... crashed: ...".
- [`_elide_output`](/qutebrowser/misc/guiprocess.py): long output is cut with
  `[N lines hidden, see :process for the full output]`, the same PID-less pointer.
- [`miscmodels.process`](/qutebrowser/completion/models/miscmodels.py): the `:process` completion
  shows `state_str()` per process, and sorts the `successful` ones last.
- [`process.html`](/qutebrowser/html/process.html): `qute://process/<pid>` shows `str(outcome)` as
  the status.
- [`editor.py`](/qutebrowser/misc/editor.py): on a `CrashExit`, the editor skips its normal path,
  and its `error` handler keeps the temporary file, with the info message "Keeping file ... as the
  editor process exited abnormally".
- [`userscripts.py`](/qutebrowser/commands/userscripts.py) and
  [`commands.py` `:spawn`](/qutebrowser/browser/commands.py): the only callers passing `verbose`,
  from `:spawn -v` and `:spawn -u -v` (and `:hint ... spawn -v`).
- [`message.py`](/qutebrowser/utils/message.py): `message.error` and `message.info` also log to the
  `message` logger, so a message is "written to the log" too.
- Recent history (`git log` on `guiprocess.py`): `038361d8a` improved the unresolved-executable
  error, `ccf624365` added the Flatpak hint. Neither touches the outcome messages.

### The proposal's path and existing actions

- **`:spawn` of a failing command**: `_on_finished` gets `NormalExit`, code 1, shows
  `Command exited with status 1. See :process for details.` With the feature, the PID follows
  `:process`.
- **Two commands, the first fails after the second started**: today `:process` opens the second.
  With the PID in the message, the user types the right one.
- **`:process <pid> terminate`** (Unix): `CrashExit`, code 15, error
  `Command crashed. See :process for details.` With the feature: nothing, or an info with
  `--verbose`.
- **`:process <pid> kill`**: `CrashExit`, code 9. With the feature: an error naming `SIGKILL`.
- **A crash (SIGSEGV, SIGABRT)**: error naming the signal.
- **`--verbose` success**: today `Command exited successfully.`, with the feature the PID suffix is
  added.
- **The editor killed by SIGTERM**: today an error, plus the "Keeping file" info. With the feature,
  only the "Keeping file" info.
- **SIGTERM on a process with output**: today stdout and stderr go to `log.procs.error`, and the
  data is kept until restart (no cleanup timer). The proposal does not say whether this changes.
- **`:process` completion and `qute://process`**: they show the new state `terminated` and the new
  outcome text without other changes.
- **Windows**: `terminate()` sends `WM_CLOSE`, so the process exits normally with its own code. A
  `CrashExit` there has a negative code, which is no signal.

### Rules and their owners

- **The outcome text and state**: owned by `ProcessOutcome` in
  [`guiprocess.py`](/qutebrowser/misc/guiprocess.py), shown by `process.html` and the completion. No
  copy.
- **What a successful exit triggers** (info message, cleanup timer, no output logging): owned by
  `GUIProcess._on_finished`. The editor copies only `was_successful()`, for its temp file.
- **The pointer to `:process`**: written in `_on_finished` and in `_elide_output`, two copies.

### Likely changes

- [`guiprocess.py`](/qutebrowser/misc/guiprocess.py): `ProcessOutcome.__str__` and `state_str()` for
  signals; `_on_finished` for the PID suffix and the SIGTERM branch. Under every option.
- [`guiprocess.py` `_elide_output`](/qutebrowser/misc/guiprocess.py): only with the PID in the
  hidden-lines hint ([pointer in output hint](#pointer-in-the-hidden-lines-hint)).
- [`test_guiprocess.py`](/tests/unit/misc/test_guiprocess.py): the tests asserting
  `See :process for details.` and `Testprocess crashed.` change; new tests for SIGTERM with and
  without verbose.
- [`spawn.feature`](/tests/end2end/features/spawn.feature) and
  [`hints.feature`](/tests/end2end/features/hints.feature): five expectations of
  `Command exited successfully.` become `Command exited successfully. See :process * for details.`;
  their matching supports `*` ([`testutils`](/tests/helpers/testutils.py)).
- [`test_models.py`](/tests/unit/completion/test_models.py): only if the completion's sorting
  changes, which no option asks.
- [`doc/changelog.asciidoc`](/doc/changelog.asciidoc): the unreleased v3.0.0 section.

## The proposal

### The requirements are written twice

The requirement list repeats each rule, with small differences. One SIGTERM rule says "treated like
a successful exit **only for GUI messaging**", its copy says "for messaging purposes". The texts of
the messages agree everywhere.

### What "like a successful exit" covers is open

A successful exit also skips the error-level logging of stdout and stderr, and starts the 1-hour
cleanup. "Only for GUI messaging" suggests neither changes for SIGTERM. Then a terminated process
with output still writes error lines to the log, and its data stays until restart.

### "The process log"

"The same text must also be the final entry written to the process log for that failed exit." The
`message.error` call already logs its text to the `message` logger, after the `log.procs` output
lines: the existing test reads it as the last captured log line
([`test_exit_unsuccessful_output`](/tests/unit/misc/test_guiprocess.py)).

### SIGKILL and other user-sent signals

Only SIGTERM becomes quiet. `:process <pid> kill` sends SIGKILL, and will show an error naming it.
The proposal does not mention this case.

### The PID-less pointer in the hidden-lines hint

The proposal fixes the pointer in the outcome message. The hint for long output,
`[N lines hidden, see :process for the full output]`, has the same flaw and is not mentioned.

### Signals with no name

The format always ends with `({signal_name})`. On Windows a `CrashExit` code is no signal, and an
unknown number makes `signal.Signals` raise.

## Worth it and feasibility

- **Worth it**: the change is small, one module and its tests, and fixes a real misdirection: the
  error points to the wrong process when two run.
- **Outside behaviour**: the signal number as `CrashExit` code is checked on Linux with Qt 6.5.1
  (table above). It is undocumented, so it stays unverified on macOS and other Qt versions; the unit
  tests that kill a child with a signal check it on each CI platform.
- **Guards relaxed**: none. Silencing SIGTERM hides a message, not a check.

## Approaches

Criteria come from the [proposal](proposal.md), the [constitution](../CONSTITUTION.md) (requirements
as written, nothing added), and the repository's patterns.

### Reach of the SIGTERM exception

What else, besides the message, a SIGTERM exit shares with a successful one. Relies on
[what "like a successful exit" covers](#what-like-a-successful-exit-covers-is-open).

| Option                                       | Matches the proposal's wording      | Error lines in the log | Data cleaned after 1h |
| -------------------------------------------- | ----------------------------------- | ---------------------- | --------------------- |
| A. Messages only                             | "only for GUI messaging", literally | yes, when output       | no                    |
| B. Messages and output logging               | between the two wordings            | no                     | no                    |
| C. Messages, output logging, and the cleanup | "for messaging purposes", stretched | no                     | yes                   |

### SIGKILL

Relies on [SIGKILL and other user-sent signals](#sigkill-and-other-user-sent-signals).

| Option                | Matches the proposal | Hides an out-of-memory kill |
| --------------------- | -------------------- | --------------------------- |
| A. Error, as proposed | yes                  | no                          |
| B. Quiet like SIGTERM | no, adds a case      | yes                         |

### Pointer in the hidden-lines hint

Relies on [the PID-less pointer](#the-pid-less-pointer-in-the-hidden-lines-hint).

| Option                            | Within the proposal | Fixes the same flaw |
| --------------------------------- | ------------------- | ------------------- |
| A. Leave it, note it in the inbox | yes                 | no                  |
| B. Add the PID there too          | beyond it           | yes                 |

### Unknown signal numbers

Relies on [signals with no name](#signals-with-no-name). Options: leave out the parenthesis when the
number is no known signal, or write a placeholder such as `(unknown signal)`. Neither changes a case
the proposal describes.

### Code-quality decision

The project has no `specs/decisions/code-quality.md`. Its linters already set limits:
[`.pylintrc`](/.pylintrc) `max-args=10`, `max-line-length=190`, and [`.flake8`](/.flake8)
`max-complexity = 12`. Options: record these as the decision, add new limits, or record that the
project has no Uraeda limits.

### Needs no choice

- **Naming the signal**: the proposal fixes the format, and `signal.Signals(code).name` gives it.
- **The PID in the outcome message**: fixed by the proposal, for success, failure, and SIGTERM.
- **Quiet on a requested stop**: fixed by the proposal for SIGTERM, which also covers a stop sent
  from outside qutebrowser, as systemd does.
- **The completion's sorting**: `terminated` sorts with the unfinished and failed ones, as
  `was_successful()` stays false per the proposal.

## Not checked

- Existing solutions to this change, qutebrowser's upstream history after this commit, and other
  browsers' code: the task forbids looking them up.
- The `CrashExit` code on macOS and Windows: no such machine here.
