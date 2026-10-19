---
status: auto-approved
spec-revision: 1
---

# Plan: Process messages

**Goal:** a finished process's message names its PID, a crash names its signal, and a SIGTERM stop
is quiet unless the process was started with `--verbose`.

**Architecture:** everything changes in [`guiprocess.py`](/qutebrowser/misc/guiprocess.py), in the
two places that own these rules today, as the [spec's architecture](spec.md#architecture) says.

- A function private to the module tells whether an outcome is a crash with code `signal.SIGTERM`.
  It owns the SIGTERM rule. `ProcessOutcome` and `GUIProcess._on_finished` both ask it, so the rule
  is written once.
- `ProcessOutcome` owns the outcome text and the short state, the signal name included.
  `was_successful()` does not change.
- `GUIProcess._on_finished` owns which message is shown, and the pointer
  `See :process <pid> for details.` added to it. Output logging and the 1-hour cleanup timer still
  follow `was_successful()` alone.

The `:process` completion and the `qute://process` page read `state_str()` and `str(outcome)`. They
get the new texts with no change of their own.

**Spec:** [spec.md](spec.md): the plan argues from the spec, so the implementer reads both.

## Review focus

The most consequential conditions or sequences the spec implies but does not name, including
interactions with existing behaviour. Each gets a test in the task that owns the code.

1. **A normal exit with code 15**, from a process calling `sys.exit(15)`, is a failure:
   `Testprocess exited with status 15.`, state `unsuccessful`, an error. Only a crash with code 15
   counts as SIGTERM. Tasks 1 and 2.
2. **A crash with code 0**, as the editor's tests emit and as Qt may report, has no signal name:
   `Testprocess crashed with status 0.` Looking up the name never raises. Task 1.
3. **A SIGTERM stop leaves the cleanup timer stopped**, so `:process <pid>` still has the data after
   1 hour. Task 2.

## Global constraints

From [code quality](../decisions/code-quality.md):

- Lines MUST NOT be longer than 190 characters, except the lines pylint's `ignore-long-lines`
  exempts, like URLs. Checked by pylint's `max-line-length` in [`.pylintrc`](/.pylintrc), run by
  `tox -e pylint`.
- Functions MUST NOT take more than 10 arguments. Checked by pylint's `max-args` in
  [`.pylintrc`](/.pylintrc), run by `tox -e pylint`.
- Functions MUST NOT have a cyclomatic complexity over 12. Checked by flake8's `max-complexity` in
  [`.flake8`](/.flake8), run by `tox -e flake8`.
- A feature or change MUST NOT change these limits in `.pylintrc` or `.flake8` unless a human asks
  for it. Checked by review.
- A function that reaches a limit SHOULD be split, rather than silenced with a `# pylint: disable=`
  or `# noqa` comment. Checked by review.

From [the spec](spec.md) and the [proposal](proposal.md):

- The message text follows `"{self.outcome} See :process {self.pid} for details."`, with the PID of
  the process that finished.
- A crash's outcome reads `"{What} {state} with status {code} ({signal_name})."`: `{What}` is the
  label with its first letter capitalized, `{state}` is `terminated` for SIGTERM and `crashed` for
  any other signal, `{code}` the signal number, `{signal_name}` from `signal.Signals`. A code that
  is no known signal leaves out the parenthesis: `Command crashed with status -1.`
- `state_str()` returns `terminated` for SIGTERM and `crashed` for any other crash.
- `was_successful()` stays false for every crash, SIGTERM included.
- A SIGTERM stop without `--verbose` shows no outcome message of any level. With `--verbose`, it
  shows an info, never an error, as its last message.
- No public function, class, or method is added.

Existing behaviour to preserve, in [`_on_finished`](/qutebrowser/misc/guiprocess.py) and its tests
in [`test_guiprocess.py`](/tests/unit/misc/test_guiprocess.py):

- Output messages from `:spawn -m` come before the outcome message, stderr as an error, also after a
  SIGTERM stop.
- An exit that is not successful logs its stdout and stderr to `log.procs` at error level, and the
  outcome error is the last log entry. A successful exit starts the 1-hour cleanup timer.
- The hidden-lines hint of `_elide_output` stays `see :process for the full output`.

## Code read

- [`guiprocess.py`](/qutebrowser/misc/guiprocess.py): `ProcessOutcome.__str__` returns
  `"{What} crashed."` on any `CrashExit`; `state_str()` returns `crashed`. `_on_finished` shows an
  info when successful and verbose, else logs the output and shows
  `str(outcome) + " See :process for details."`. About 35 lines, far from the limits.
- [`test_guiprocess.py`](/tests/unit/misc/test_guiprocess.py): the `proc` fixture is a real
  `GUIProcess('testprocess')`; `py_proc` builds a Python child; `message_mock` collects messages,
  `getmsg(level)` asserts there is exactly one. `test_exit_crash` kills a child with SIGSEGV
  (`@pytest.mark.posix`). `test_exit_unsuccessful` and `test_exit_unsuccessful_output` assert the
  PID-less pointer.
- [`test_editor.py`](/tests/unit/misc/test_editor.py): `test_crash` emits `Crashed` then
  `finished(0, CrashExit)` on the editor's process.
- [`editor.py`](/qutebrowser/misc/editor.py): on a crash, `_on_proc_error` keeps the file with the
  info "... as the editor process exited abnormally".
- [`test_models.py`](/tests/unit/completion/test_models.py): `test_process_completion` sets outcomes
  by hand on fake processes and checks the states listed.
- [`spawn.feature`](/tests/end2end/features/spawn.feature) line 7 and
  [`hints.feature`](/tests/end2end/features/hints.feature) lines 65, 70, 75, 81 expect
  `Command exited successfully.`; their message matching supports `*`.
- [`test_qutescheme.py`](/tests/unit/browser/test_qutescheme.py): checks `str(outcome)` appears in
  `qute://process`, with a success; no change needed.
- [`doc/changelog.asciidoc`](/doc/changelog.asciidoc): v3.0.0 is unreleased, with a `Changed`
  section.
- Validation:
  `QUTE_QT_WRAPPER=PyQt6 QT_QPA_PLATFORM=offscreen python -m pytest -o required_plugins= -o addopts=--strict-markers <paths>`
  runs the unit tests here (pytest-instafail is not installed). The limits:
  `python -m flake8 <files>`, and
  `python -m pylint --disable=all --enable=line-too-long,too-many-arguments <files>`. The end-to-end
  tests need a full browser setup, not available here.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

| Abstraction or exception          | Why it is needed                                                                 | Simpler alternative rejected because                                  |
| --------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| The private SIGTERM test function | Two callers, the outcome's text and state and the finish handler, share the rule | Comparing status and code in each place writes the SIGTERM rule twice |

## Test map

The tests are pytest unit tests on a real `GUIProcess`, running real Python children through Qt,
with `message_mock` collecting messages and `caplog` the log. Signals are sent for real, so they
also check Qt's crash codes on each platform the suite runs on.

| Spec                                                      | Task | Test                                                                            |
| --------------------------------------------------------- | ---- | ------------------------------------------------------------------------------- |
| US2 1; SC-003 SIGSEGV                                     | 1, 2 | `test_guiprocess.py`, `test_exit_crash`                                         |
| US2 2; SC-003 SIGKILL                                     | 1, 2 | `test_guiprocess.py`, `test_exit_kill`                                          |
| SC-003 SIGABRT                                            | 1    | `test_guiprocess.py`, `test_crash_signal_names`                                 |
| US2 3                                                     | 1    | `test_models.py`, `test_process_completion`                                     |
| US2 more 1; edge case: a code that is no signal           | 1    | `test_guiprocess.py`, `test_crash_without_signal_name`                          |
| US3 3; SC-003 SIGTERM                                     | 1    | `test_guiprocess.py`, `test_exit_sigterm`                                       |
| Review focus: a crash with code 0                         | 1    | `test_guiprocess.py`, `test_crash_without_signal_name`                          |
| Review focus: a normal exit with code 15                  | 1, 2 | `test_guiprocess.py`, `test_exit_status_15`                                     |
| US1 1                                                     | 2    | `test_guiprocess.py`, `test_exit_unsuccessful`, `test_exit_unsuccessful_output` |
| US1 2                                                     | 2    | `test_guiprocess.py`, `test_start_verbose`; end-to-end features                 |
| US1 3; SC-001                                             | 2    | `test_guiprocess.py`, `test_exit_unsuccessful_other_process_started`            |
| US1 more 1                                                | 2    | `test_guiprocess.py`, `test_start`, unchanged                                   |
| US3 1; SC-002                                             | 2    | `test_guiprocess.py`, `test_exit_sigterm`                                       |
| US3 2                                                     | 2    | `test_guiprocess.py`, `test_exit_sigterm_verbose`                               |
| US3 more 1; Review focus: the cleanup timer after SIGTERM | 2    | `test_guiprocess.py`, `test_exit_sigterm_output`                                |
| US3 more 2; edge case: the editor stopped with SIGTERM    | 2    | `test_editor.py`, `test_sigterm`                                                |
| Edge case: a shell exiting with 143                       | 2    | `test_guiprocess.py`, `test_exit_status_15`, parametrized with 143              |
| Edge case: `:spawn -m` and SIGTERM with stderr            | 2    | `test_guiprocess.py`, `test_exit_sigterm_output`                                |
| Edge case: `:process` without a PID                       | 2    | `test_guiprocess.py`, `TestProcessCommand.test_last_pid`, unchanged             |
| Edge case: output over 20 lines                           | 2    | `test_guiprocess.py`, `test_elided_output`, unchanged                           |
| Edge case: `:process 1234 terminate` on Windows           | none | Qt's own behaviour, unchanged; no Windows machine here                          |

## Waves

The tasks of a wave are built at the same time, then merged and reviewed while the next wave starts.

1. Task 1: the outcome's text and state, and the SIGTERM test task 2 uses.
2. Task 2: the finish handler's messages, built on task 1's SIGTERM test and texts.

---

## Task 1: Signal names and the terminated state in the outcome

**Files:**

- Modify: `qutebrowser/misc/guiprocess.py` (`ProcessOutcome.__str__`, `ProcessOutcome.state_str`, a
  new private function)
- Test: `tests/unit/misc/test_guiprocess.py`, `tests/unit/completion/test_models.py`
  (`test_process_completion`)

**Interfaces:**

- Produces: a module-private function `_is_sigterm(outcome: ProcessOutcome) -> bool`, true when the
  outcome's status is `CrashExit` and its code is `signal.SIGTERM`. Task 2 uses it.
- Produces, changed behaviour: `str(outcome)` of a crash reads
  `"{What} terminated with status 15 (SIGTERM)."` for SIGTERM,
  `"{What} crashed with status {code} ({name})."` for a known signal, and
  `"{What} crashed with status {code}."` otherwise. `state_str()` returns `terminated` for SIGTERM.

- [x] **Step 1: Write the failing tests**

In `test_guiprocess.py`, the outcome assertions, for children killed for real (`posix`): a helper
starting `import time; time.sleep(60)` and waiting for `started`, then calling
`proc.terminate(kill=...)`, or a child sending itself a signal as `test_exit_crash` does.

```python
# test_exit_crash, SIGSEGV
assert str(proc.outcome) == 'Testprocess crashed with status 11 (SIGSEGV).'
assert proc.outcome.state_str() == 'crashed'

# test_exit_kill: proc.terminate(kill=True)
assert proc.outcome.code == 9
assert str(proc.outcome) == 'Testprocess crashed with status 9 (SIGKILL).'

# test_exit_sigterm: proc.terminate()
assert proc.outcome.status == QProcess.ExitStatus.CrashExit
assert str(proc.outcome) == 'Testprocess terminated with status 15 (SIGTERM).'
assert proc.outcome.state_str() == 'terminated'
assert not proc.outcome.was_successful()

# test_crash_signal_names, parametrized on a ProcessOutcome built by hand
@pytest.mark.parametrize('code, text', [
    (signal.SIGABRT, f'Testprocess crashed with status {signal.SIGABRT.value} (SIGABRT).'), ...])

# test_crash_without_signal_name, parametrized on -1 and 0
outcome = guiprocess.ProcessOutcome('testprocess', status=QProcess.ExitStatus.CrashExit, code=-1)
assert str(outcome) == 'Testprocess crashed with status -1.'
assert outcome.state_str() == 'crashed'

# test_exit_status_15, parametrized on 15 and 143: a child calling sys.exit(code)
assert str(proc.outcome) == f'Testprocess exited with status {code}.'
assert proc.outcome.state_str() == 'unsuccessful'
```

Use `signal.SIGABRT.value` in the expected text of the hand-built case, since its number differs
between platforms. In `test_models.py`, add two finished processes to `test_process_completion`: one
with `CrashExit` and code 11, expected `crashed`, one with `CrashExit` and code 15, expected
`terminated`, both listed before the successful one.

The break each test catches:

- `test_exit_crash`, `test_exit_kill`: a signal name looked up from the wrong value, or Qt giving
  something else than the signal number as the crash code on this platform.
- `test_exit_sigterm`: SIGTERM labelled `crashed`, or counted as successful.
- `test_crash_without_signal_name`: `signal.Signals(code)` called without catching its `ValueError`,
  or a placeholder in place of the missing name.
- `test_exit_status_15`: the SIGTERM test comparing the code only, ignoring the status.
- `test_process_completion`: `terminated` sorted with the successful processes.

- [x] **Step 2: Run them to check they fail**

- Run:
  `QUTE_QT_WRAPPER=PyQt6 QT_QPA_PLATFORM=offscreen python -m pytest -o required_plugins= -o addopts=--strict-markers tests/unit/misc/test_guiprocess.py tests/unit/completion/test_models.py -k "crash or kill or sigterm or status_15 or process_completion"`
- Expected: FAIL,
  `assert 'Testprocess crashed.' == 'Testprocess crashed with status 11 (SIGSEGV).'`.
  `test_exit_status_15` passes already: it pins existing behaviour.

- [x] **Step 3: Implement the outcome texts and states**

In `ProcessOutcome`, the crash branch of `__str__` builds the text from the global constraints, with
`terminated` when `_is_sigterm(self)`, and the signal's name from `signal.Signals(code).name`, left
out when the code is no known signal. `state_str()` returns `terminated` before `crashed` when
`_is_sigterm(self)`. Keep the existing order of checks: running, not started, crash, success,
failure.

- [x] **Step 4: Run the project's validation**

- Run:
  `QUTE_QT_WRAPPER=PyQt6 QT_QPA_PLATFORM=offscreen python -m pytest -o required_plugins= -o addopts=--strict-markers tests/unit/misc/ tests/unit/completion/test_models.py tests/unit/browser/test_qutescheme.py`
- Expected: PASS, except `test_exit_crash`'s message assertion, which task 2 changes. Update its
  message expectation to `Testprocess crashed with status 11 (SIGSEGV). See :process for details.`
  here, so this task's suite passes.
- Run:
  `python -m flake8 qutebrowser/misc/guiprocess.py tests/unit/misc/test_guiprocess.py tests/unit/completion/test_models.py`,
  and `python -m pylint --disable=all --enable=line-too-long,too-many-arguments` on the same files
- Expected: no message.

- [x] **Step 5: Commit**

```bash
git add qutebrowser/misc/guiprocess.py tests/unit/misc/test_guiprocess.py tests/unit/completion/test_models.py
git commit -m "feat(qutebrowser-process-messages): name the signal of a crash"
```

## Task 2: The PID pointer, and quiet SIGTERM stops

**Files:**

- Modify: `qutebrowser/misc/guiprocess.py` (`GUIProcess._on_finished`)
- Test: `tests/unit/misc/test_guiprocess.py`, `tests/unit/misc/test_editor.py`
- Modify: `tests/end2end/features/spawn.feature`, `tests/end2end/features/hints.feature`,
  `doc/changelog.asciidoc`

**Interfaces:**

- Consumes: `_is_sigterm(outcome: ProcessOutcome) -> bool` and the outcome texts, from task 1.
- Produces, changed behaviour: every outcome message `_on_finished` shows ends with
  `See :process {pid} for details.`; a SIGTERM stop shows an info only with `verbose`, and nothing
  otherwise.

- [x] **Step 1: Write the failing tests**

In `test_guiprocess.py`:

```python
# test_start_verbose
assert msgs[1].text == f"Testprocess exited successfully. See :process {proc.pid} for details."

# test_exit_unsuccessful, and caplog.messages[-1] in test_exit_unsuccessful_output
expected = f"Testprocess exited with status 1. See :process {proc.pid} for details."

# test_exit_crash
assert msg.text == f"Testprocess crashed with status 11 (SIGSEGV). See :process {proc.pid} for details."

# test_exit_kill
assert message_mock.getmsg(usertypes.MessageLevel.error).text == (
    f"Testprocess crashed with status 9 (SIGKILL). See :process {proc.pid} for details.")

# test_exit_unsuccessful_other_process_started: a second GUIProcess started and still running
# when the first exits with 1
assert msg.text.endswith(f"See :process {first.pid} for details.")
assert first.pid != second.pid

# test_exit_sigterm, without verbose
assert not message_mock.messages

# test_exit_sigterm_verbose
assert msgs[-1].level == usertypes.MessageLevel.info
assert msgs[-1].text == f"Testprocess terminated with status 15 (SIGTERM). See :process {proc.pid} for details."
assert not [m for m in msgs if m.level == usertypes.MessageLevel.error]

# test_exit_sigterm_output: output_messages on, a child printing "oops" on stderr, then sleeping
assert {(m.level, m.text) for m in message_mock.messages} == {(usertypes.MessageLevel.error, 'oops')}
assert 'Process stderr:\noops' in caplog.messages
assert not proc._cleanup_timer.isActive()

# test_exit_status_15, parametrized on 15 and 143
assert message_mock.getmsg(usertypes.MessageLevel.error).text == (
    f"Testprocess exited with status {code}. See :process {proc.pid} for details.")
```

In `test_editor.py`, `test_sigterm`, next to `test_crash`: emit `Crashed`, then
`finished(15, CrashExit)` on the editor's process, with `message_mock`. Assert no error-level
message, and one info containing `as the editor process exited abnormally`; the file still exists.

In the end-to-end features, the five `Command exited successfully.` expectations become
`Command exited successfully. See :process * for details.`

The break each test catches:

- The PID tests: the pointer written with `last_pid`, or without a PID, as today.
- `test_exit_sigterm`: SIGTERM still showing an error, or an info without `verbose`.
- `test_exit_sigterm_verbose`: the info shown with the error level, or without the pointer.
- `test_exit_sigterm_output`: the quiet branch also skipping the output logging, or starting the
  cleanup timer, which Q1's answer keeps for failures only.
- `test_exit_status_15`: a normal exit with code 15 taken for a SIGTERM stop and silenced.
- `test_sigterm` in the editor: the editor's own crash path losing its "Keeping file" info.

- [x] **Step 2: Run them to check they fail**

- Run:
  `QUTE_QT_WRAPPER=PyQt6 QT_QPA_PLATFORM=offscreen python -m pytest -o required_plugins= -o addopts=--strict-markers tests/unit/misc/test_guiprocess.py tests/unit/misc/test_editor.py`
- Expected: FAIL, `test_start_verbose`:
  `assert 'Testprocess exited successfully.' == 'Testprocess exited successfully. See :process ... for details.'`

- [x] **Step 3: Implement the messages in `_on_finished`**

Build the text once, `f"{self.outcome} See :process {self.pid} for details."`. When successful, or
when `_is_sigterm(self.outcome)`, show it as an info only if `self.verbose`; otherwise show it as an
error. Keep the output logging when not successful, and the cleanup timer when successful, as they
are.

- [x] **Step 4: Add the changelog entry**

Under v3.0.0's `Changed`: process messages name the PID to pass to `:process`, a crash names its
signal, and a process stopped with SIGTERM shows no error, only an info with `:spawn --verbose`.

- [x] **Step 5: Run the project's validation**

- Run:
  `QUTE_QT_WRAPPER=PyQt6 QT_QPA_PLATFORM=offscreen python -m pytest -o required_plugins= -o addopts=--strict-markers tests/unit/misc/ tests/unit/completion/test_models.py tests/unit/browser/test_qutescheme.py tests/unit/commands/`
- Expected: PASS
- Run: `python -m flake8` and
  `python -m pylint --disable=all --enable=line-too-long,too-many-arguments` on
  `qutebrowser/misc/guiprocess.py tests/unit/misc/test_guiprocess.py tests/unit/misc/test_editor.py`
- Expected: no message.

- [x] **Step 6: Commit**

```bash
git add qutebrowser/misc/guiprocess.py tests/unit/misc/test_guiprocess.py tests/unit/misc/test_editor.py tests/end2end/features/spawn.feature tests/end2end/features/hints.feature doc/changelog.asciidoc
git commit -m "feat(qutebrowser-process-messages): point to the finished process, quiet SIGTERM"
```
