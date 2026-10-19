---
status: auto-approved
spec-revision: 1
---

# Plan: Process messages

**Goal:** A finished process's messages name its own PID, a SIGTERM exit is silent unless
`--verbose`, and a crash names its signal.

**Architecture:** All code lives in [`guiprocess.py`](/qutebrowser/misc/guiprocess.py), as in the
spec's [architecture](spec.md#architecture). `ProcessOutcome` owns the outcome text and the state:
it derives the signal from `code` when `status` is `CrashExit`. `GUIProcess._on_finished` owns the
`See :process <pid> for details.` suffix and the choice of message, and treats a SIGTERM exit like a
success for messages and the cleanup timer. No other file changes except the tests and the
changelog.

**Spec:** [spec.md](spec.md)

## Review focus

- A SIGTERM exit without `--verbose` must not dump stdout or stderr to the log: Task 2, test
  `test_exit_sigterm_silent`.
- Output messages (`output_messages=True`) still come before the failure text: Task 2, test
  `test_exit_unsuccessful_output`.
- An editor killed by SIGTERM still sees `was_successful()` false: Task 2, test in
  `test_exit_sigterm_verbose`.

## Global constraints

- The message text is `"{self.outcome} See :process {self.pid} for details."`, with the actual PID.
- Successful exit: `{What} exited successfully.`; failed exit: `{What} exited with status {code}.`
- Signal exit: `{What} {state} with status {code} ({signal_name}).`, `{state}` is `terminated` for
  SIGTERM and `crashed` for another signal; `{code}` is the signal number.
- `state_str()` returns `terminated` for SIGTERM, `crashed` for another signal.
- `was_successful()` stays false for SIGTERM.
- SIGTERM without `--verbose`: no message of any level. With it: an info message, the last one
  emitted, never an error.
- The failure text is the last entry of the process log, after the stdout and stderr dumps.
- A code Python cannot name keeps `{What} crashed.`
- Constitution: tests cover the acceptance scenarios; follow the repository's patterns.

## Code read

- [`ProcessOutcome` and `_on_finished`](/qutebrowser/misc/guiprocess.py): the outcome text uses
  `status`/`code`; `_on_finished` sends `See :process for details.` with no PID and starts
  `_cleanup_timer` only on success.
- [`editor.py:117`](/qutebrowser/misc/editor.py) uses `was_successful()` only: unchanged.
- [`miscmodels.py:326`](/qutebrowser/completion/models/miscmodels.py) sorts by
  `state_str() == 'successful'`, so `terminated` sorts with the unsuccessful ones, as the spec asks:
  no change.
- [`test_guiprocess.py`](/tests/unit/misc/test_guiprocess.py): the `proc` fixture, `py_proc`,
  `message_mock`, `caplog`; tests run real processes. Validation:
  `pytest tests/unit/misc/test_guiprocess.py tests/unit/completion/test_models.py`.
- [`changelog.asciidoc`](/doc/changelog.asciidoc): `v3.0.0` has a `Changed` section for the entry.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

None.

## Test map

Integration tests run real Python child processes through `GUIProcess`, with `message_mock` and
`caplog`.

| Spec item                             | Task | Test                                             |
| ------------------------------------- | ---- | ------------------------------------------------ |
| Unverified: Qt reports signal as code | 1    | `test_exit_signal_code`                          |
| US1.1, US1.2, SC-001                  | 2    | `test_exit_unsuccessful`, `_output`              |
| US1.3 second process, PID             | 2    | `test_exit_unsuccessful_own_pid`                 |
| US2.1, SC-002                         | 2    | `test_exit_sigterm_silent`                       |
| US2.2                                 | 2    | `test_exit_sigterm_verbose`                      |
| US3.1, US3.2, SC-003                  | 2    | `test_exit_crash` (SIGSEGV, SIGKILL)             |
| US4.1                                 | 2    | `test_start_verbose`                             |
| Success without verbose is silent     | 2    | `test_start`                                     |
| `terminated` state in completion      | 2    | `test_exit_sigterm_verbose` (`state_str`)        |
| Unnamed crash code                    | 2    | `test_outcome_unknown_signal`                    |
| SC-004                                | 2    | all of the above, and `test_models.py` unchanged |

## Waves

- Wave 1: Task 1.
- Wave 2: Task 2, which relies on the verified behaviour.

---

## Task 1: Verify Qt reports the signal number

**Files:**

- Test: `tests/unit/misc/test_guiprocess.py`

**Interfaces:**

- Produces: confirmation that a process killed by a signal gives `status == CrashExit` and
  `code == signal number` on Unix.

- [x] **Step 1: Write the test**

```python
@pytest.mark.posix
@pytest.mark.parametrize("sig", [signal.SIGTERM, signal.SIGSEGV])
def test_exit_signal_code(qtbot, proc, py_proc, caplog, sig):
    with caplog.at_level(logging.ERROR):
        with qtbot.wait_signal(proc.finished, timeout=10000):
            proc.start(*py_proc(f"import os, signal; os.kill(os.getpid(), {int(sig)})"))
    assert proc.outcome.status == QProcess.ExitStatus.CrashExit
    assert proc.outcome.code == sig
```

The break it catches: Qt reporting another code, which would make the signal name unobtainable.

- [x] **Step 2: Run it**

- Run: `pytest tests/unit/misc/test_guiprocess.py -k test_exit_signal_code`
- Expected: PASS. If it fails, stop and go back to the human with a new round of questions.

- [x] **Step 3: Commit** `test(process-messages): check Qt reports signal numbers`

## Task 2: Outcome text, messages and PID

**Files:**

- Modify: `qutebrowser/misc/guiprocess.py` (`ProcessOutcome`, `GUIProcess._on_finished`)
- Modify: `tests/unit/misc/test_guiprocess.py`, `doc/changelog.asciidoc`

**Interfaces:**

- Consumes: Task 1's verified behaviour.
- Produces: new `ProcessOutcome` texts and states; `_on_finished` messages with the PID.

- [x] **Step 1: Write the failing tests**

Update existing tests to the new texts, and add:

- `test_exit_unsuccessful`, `test_exit_unsuccessful_output`: text
  `Testprocess exited with status 1. See :process {proc.pid} for details.`, also the last log entry.
- `test_exit_unsuccessful_own_pid`: after failing a process, start a second one; the first's message
  names the first PID.
- `test_start_verbose`: `Testprocess exited successfully. See :process {proc.pid} for details.`
- `test_exit_crash`, parametrized SIGSEGV (`crashed with status 11 (SIGSEGV)`) and SIGKILL
  (`crashed with status 9 (SIGKILL)`): error with the PID suffix; `state_str() == 'crashed'`.
- `test_exit_sigterm_silent`: no messages (`message_mock.messages` empty after the "Executing" info
  is excluded, as no `--verbose`), no `Process stdout/stderr` log entry, even with output written;
  `state_str() == 'terminated'`, `not was_successful()`.
- `test_exit_sigterm_verbose`: last message is info
  `Testprocess terminated with status 15 (SIGTERM). See :process {proc.pid} for details.`; no error.
- `test_outcome_unknown_signal`:
  `ProcessOutcome(what="testprocess", status=CrashExit, code=0xC0000005)` gives
  `Testprocess crashed.`

The break each catches: a bare `:process`, the PID of the last process, an error for SIGTERM, a
missing signal name.

- [x] **Step 2: Run them**

- Run: `pytest tests/unit/misc/test_guiprocess.py`
- Expected: FAIL, e.g.
  `'Testprocess exited with status 1. See :process for details.' != ... 1234 ...`

- [x] **Step 3: Implement in `guiprocess.py`**

`ProcessOutcome`: add a private helper returning the `signal.Signals` for `code` when `status` is
`CrashExit`, or `None` when the code is not a valid signal (`ValueError`). `__str__` for a signal
gives `{What} {state} with status {code} ({name}).`, else the old crash text. `state_str()` returns
`terminated` for SIGTERM. `was_successful()` is unchanged. Add a `was_sigterm()` check used by the
handler.

`_on_finished`: when successful or SIGTERM, send `message.info` of the outcome plus suffix only with
`verbose`, and start `_cleanup_timer`. Otherwise log the stdout/stderr dumps, then `log.procs.error`
the failure text, and `message.error` it. The suffix is
`f"{self.outcome} See :process {self.pid} for details."`, built once. The log entry is written after
the dumps and before or with the error message.

- [x] **Step 4: Add the changelog entry** under `v3.0.0` `Changed`: processes started via `:spawn`
      and the like no longer show an error for SIGTERM unless `--verbose`, show the signal name on
      crashes, and the message references the right PID.

- [x] **Step 5: Run the validation**

- Run: `pytest tests/unit/misc/test_guiprocess.py tests/unit/completion/test_models.py`
- Expected: PASS

- [x] **Step 6: Commit** `feat(process-messages): name the process PID and signal in messages`
