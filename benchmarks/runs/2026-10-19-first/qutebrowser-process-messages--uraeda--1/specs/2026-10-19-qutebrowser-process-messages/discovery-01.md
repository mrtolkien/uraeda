# Discovery, round 01: Process messages

## Summary

`GUIProcess` ([guiprocess.py](/qutebrowser/misc/guiprocess.py)) wraps a `QProcess` and reports its
outcome as GUI messages. Three things are wrong today. The failure message ends in a bare
`See :process for details.`, and `:process` without a PID shows the last process started, which is
not always the one that failed. A SIGTERM exit shows an error. Any signal exit shows only
`<What> crashed.`, with no signal. The proposal fixes all three inside `GUIProcess` and
`ProcessOutcome`, and adds no new interface.

## How other products do it

Not researched. The proposal forbids looking up existing solutions, external PRs, or online
workarounds, so no product or online source was read. See [Not checked](#not-checked).

## Standards and libraries

### Qt's exit status and code

- Qt's `QProcess.finished(int, ExitStatus)` signal gives `CrashExit` when the process crashed. On
  Unix the code is then the signal number. This is Qt's documented behaviour and is not verified in
  this session: Qt's documentation was not read. The existing test
  [`test_exit_crash`](/tests/unit/misc/test_guiprocess.py) kills a process with `SIGSEGV` and
  asserts `CrashExit`, which agrees. The plan's first task must check that the code equals the
  signal number, including for `SIGTERM`.
- On Windows the code of a crash is an exception code, not a signal number. The code already
  separates Windows in [`_on_error`](/qutebrowser/misc/guiprocess.py): there a `Crashed` error is
  reported there and not in `_on_finished`.

### Python's `signal` module

- Checked by running it in this session: `signal.Signals(11).name` is `SIGSEGV`, and
  `signal.Signals(15).name` is `SIGTERM`. `signal.Signals(300)` raises `ValueError`. An unknown code
  needs a fallback.

## The code

### Important reads

- [`qutebrowser/misc/guiprocess.py`](/qutebrowser/misc/guiprocess.py): holds everything the proposal
  touches.
  - `ProcessOutcome` (`was_successful`, `__str__`, `state_str`) builds the outcome text. A crash
    gives `<What> crashed.` and never mentions the code.
  - `GUIProcess._on_finished` sets the outcome, shows stdout and stderr, then branches on
    `was_successful()`. A success shows an info message only when verbose, and starts the cleanup
    timer. Any other exit logs stdout and stderr, and shows
    `str(outcome) + " See :process for details."` as an error.
  - Module state `last_pid`, set in `_post_start`, is what `:process` uses without an argument. This
    is the cause of the wrong-process bug: the message never names `self.pid`.
  - `_on_error` already returns early for `Crashed` on non-Windows, so a crash gives one message.
- [`tests/unit/misc/test_guiprocess.py`](/tests/unit/misc/test_guiprocess.py): the tests
  `test_start_verbose`, `test_exit_unsuccessful`, `test_exit_crash`, and the output tests (around
  line 474) assert the old texts, so they change.
- [`qutebrowser/completion/models/miscmodels.py`](/qutebrowser/completion/models/miscmodels.py)
  shows `state_str()` in the `:process` completion, and sorts successful processes apart (line 326).
  Its test is in [`test_models.py`](/tests/unit/completion/test_models.py) (line 1485).
- [`qutebrowser/html/process.html`](/qutebrowser/html/process.html) shows `proc.outcome` as text. It
  takes the new texts without change.
- [`qutebrowser/misc/editor.py`](/qutebrowser/misc/editor.py) uses `outcome.was_successful()`.
  Because `was_successful()` stays false for SIGTERM, the editor behaves as today.
- [`qutebrowser/commands/userscripts.py`](/qutebrowser/commands/userscripts.py) listens to
  `finished` only, not to outcome text.

### The proposal's path and existing actions

- A process fails: `_on_finished` shows the error. Today the pid is missing. Afterwards it is
  `See :process <pid> for details.`
- `:process terminate` sends SIGTERM through [`terminate()`](/qutebrowser/misc/guiprocess.py). The
  user asked for it, yet today they get an error. This is the case the proposal removes.
- `:process kill` sends SIGKILL. It is a signal exit other than SIGTERM, so it becomes
  `crashed with status 9 (SIGKILL)`, an error.
- The 1-hour cleanup of successful processes: a SIGTERM exit is treated "like a successful exit" for
  messaging. The proposal does not say whether it is also cleaned up after an hour.
- `qute://process/<pid>` and the `:process` completion show the new outcome text and the new
  `terminated` state.

### Rules and their owners

- The outcome text is owned by `ProcessOutcome.__str__`. `_on_finished` appends its suffix, so the
  suffix is the only copy.
- The state names are owned by `ProcessOutcome.state_str`. Its two consumers are the completion
  model and its test.

### Likely changes

- [`guiprocess.py`](/qutebrowser/misc/guiprocess.py): `ProcessOutcome` gets the signal text and the
  `terminated` state. `_on_finished` appends `self.pid`, treats SIGTERM as a success for messages,
  and logs the failure text last.
- [`test_guiprocess.py`](/tests/unit/misc/test_guiprocess.py) and
  [`test_models.py`](/tests/unit/completion/test_models.py): updated texts, and new SIGTERM and
  signal-name cases.
- [`doc/changelog.asciidoc`](/doc/changelog.asciidoc): optional entry, following the file's habit.

## The proposal

### The requirements repeat themselves

Several requirements appear twice, once in general words and once with examples: the verbose success
message, the failure message, the signal text, `state_str()`, and the SIGTERM rule. The copies
agree. The only differences are the extra examples and two extra statements in the first copy:
`was_successful()` stays false for SIGTERM, and the failure text must be the last entry of the
process log. The spec will state each rule once.

### "Final emitted message" and "final entry of the process log"

- With SIGTERM and `--verbose`, the info message must be the last one emitted. Output messages for
  stdout and stderr (only when `output_messages` is on) are emitted first in `_on_finished`, so the
  order already holds if the new message stays last.
- For a failed exit, the same text must be the last entry of the process log. Today the log gets
  only the stdout and stderr dumps, so a new log line is needed after them.

### Signals without a name

Python cannot name every code. A Windows crash code, or a number that is not a signal, raises
`ValueError`. The proposal defines no text for it.

## Worth it and feasibility

Small and contained: one file of code and two test files. The cost is low and the gain is real, as
the wrong-PID message can send the user to the wrong process. Outside behaviour relied on: that Qt
reports the signal number as the code on Unix. It is unverified here, see
[Qt's exit status and code](#qts-exit-status-and-code). No security guard is relaxed.

## Approaches

Criteria come from [the proposal](proposal.md) and the [constitution](../CONSTITUTION.md): keep
every requirement as written, add nothing it does not ask for, test every scenario.

### Scope

The proposal is fully specified, so one topic remains: whether to build exactly its requirements.

| Option                                                                   | Matches proposal | Extra work |
| ------------------------------------------------------------------------ | ---------------- | ---------- |
| A. Build exactly the requirements, with the gaps settled as listed below | yes              | none       |
| B. Also change `:process` to default to the failed process               | no               | more       |

### Needs no choice

- Product comparisons: not applicable, see [Not checked](#not-checked).
- Accessibility, locales, and time: the messages are plain English text, like the existing ones.
- Existing data: the messages and states are not stored.

## Not checked

- How other products report process exits. The proposal's constraint forbids looking up existing
  solutions, so none was searched.
- Qt's documentation for the code on `CrashExit`. Only the existing test was read.
