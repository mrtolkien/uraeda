---
status: auto-approved
spec-revision: 1
---

# Plan: Process message improvements

**Goal:** A finished process's message names its own PID, a crash names its signal, and a SIGTERM
exit is quiet unless `--verbose`.

**Architecture:** Everything stays in [`guiprocess.py`](/qutebrowser/misc/guiprocess.py), as in the
spec's [architecture](spec.md#architecture). `ProcessOutcome` owns the outcome text and state names,
including the signal name and the unknown-number rule. `GUIProcess._on_finished` owns what is
emitted and logged, including the PID suffix and the SIGTERM branch. `was_successful()` stays false
for SIGTERM, so [`editor.py`](/qutebrowser/misc/editor.py) is unchanged.

**Spec:** [spec.md](spec.md)

## Review focus

- A crash whose code is no signal number (4242): `signal.Signals(4242)` raises `ValueError`, which
  must not escape `__str__`. Task 1 tests it.
- A SIGTERM exit with output and no `--verbose`: output messages still appear, no outcome message
  follows. Task 2 tests it.

## Global constraints

- The outcome message is `"{self.outcome} See :process {self.pid} for details."`, with the finished
  process's own PID.
- Crash text: `"{What} {state} with status {code} ({signal_name})."`, `{state}` is `terminated` for
  `SIGTERM` and `crashed` otherwise; an unknown number gives `{What} crashed with status {code}.`
- `was_successful()` stays false for SIGTERM; `state_str()` returns `terminated` for it.
- A SIGTERM exit emits no message without `--verbose`, an info message with it, starts no cleanup
  timer, and does not log stdout and stderr at error level.
- No decision is created or changed; no new interface.

## Code read

- [`guiprocess.py`](/qutebrowser/misc/guiprocess.py): `ProcessOutcome.__str__`, `state_str`,
  `was_successful`, `GUIProcess._on_finished` (the only place with the suffix).
- [`test_guiprocess.py`](/tests/unit/misc/test_guiprocess.py): real processes through the `proc`,
  `py_proc`, `message_mock` and `caplog` fixtures. Old-text tests: `test_start_verbose`,
  `test_exit_unsuccessful`, `test_exit_crash`, `test_exit_unsuccessful_output`.
- [`miscmodels.py`](/qutebrowser/completion/models/miscmodels.py) shows `state_str()`; it needs no
  change for the new `terminated` value.
- Validation: `python -m pytest tests/unit/misc/test_guiprocess.py`, then
  `python -m flake8 qutebrowser/misc/guiprocess.py` and
  `python -m mypy qutebrowser/misc/guiprocess.py` when installed.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Complexity tracking

None.

## Test map

The tests run real child processes through `proc` and `py_proc`, with `message_mock` and `caplog`.

| Spec item                         | Task | Test                                                      |
| --------------------------------- | ---- | --------------------------------------------------------- |
| US1.1, US1.2 failed exit          | 2    | `test_exit_unsuccessful`, `test_exit_unsuccessful_output` |
| US1.3 verbose success             | 2    | `test_start_verbose`                                      |
| US1 more 1: silent success        | 2    | `test_start` (unchanged)                                  |
| US1 more 2: outcome last          | 2    | `test_exit_unsuccessful_output`                           |
| US2.1 SIGSEGV text and message    | 1, 2 | `test_exit_crash`                                         |
| US2.2 SIGTERM `state_str`         | 1    | `test_exit_sigterm`                                       |
| US2.3 SIGSEGV `state_str`         | 1    | `test_exit_crash`                                         |
| US2 more 1: unknown code          | 1    | `test_outcome_unknown_signal`                             |
| US3.1 SIGTERM silent              | 2    | `test_exit_sigterm_quiet`                                 |
| US3.2 SIGTERM verbose             | 2    | `test_exit_sigterm_verbose`                               |
| US3.3 not successful              | 1    | `test_exit_sigterm`                                       |
| Edge: SIGTERM with output         | 2    | `test_exit_sigterm_output`                                |
| Review focus: unknown signal code | 1    | `test_outcome_unknown_signal`                             |
| SC-004 changelog                  | 2    | changelog entry                                           |

## Waves

- Wave 1: Task 1. Wave 2: Task 2 (consumes Task 1's outcome text and `terminated`).

---

## Task 1: Signal names in `ProcessOutcome`

Checks first the outside behaviour the spec marks unverified: that Qt reports the signal number as
the crash exit code.

**Files:**

- Modify: `qutebrowser/misc/guiprocess.py` (`ProcessOutcome`)
- Test: `tests/unit/misc/test_guiprocess.py`

**Interfaces:**

- Produces: `ProcessOutcome.__str__` crash text, `state_str()` returning `terminated`, and
  `ProcessOutcome.was_sigterm() -> bool` (crash exit with code 15), used by Task 2.

- [x] **Step 1: Write the failing tests**

`test_exit_sigterm` (posix): child kills itself with `SIGTERM`; asserts `outcome.code == 15`, text
`Testprocess terminated with status 15 (SIGTERM).`, `state_str() == 'terminated'`, not
`was_successful()`. Update `test_exit_crash` to expect
`Testprocess crashed with status 11 (SIGSEGV).`. `test_outcome_unknown_signal`: `ProcessOutcome`
with `CrashExit` and code 4242 gives `Testprocess crashed with status 4242.` and `crashed`.

The break each test catches: a code that is not the signal number (the unverified Qt behaviour); a
`ValueError` from an unknown number; SIGTERM reported as `crashed`.

- [x] **Step 2: Run them to check they fail**

- Run: `python -m pytest tests/unit/misc/test_guiprocess.py -k "sigterm or crash or unknown_signal"`
- Expected: FAIL, `Testprocess crashed.` differs from the new text. If `outcome.code` is not 15,
  stop and go back to the human.

- [x] **Step 3: Implement the text and state in `ProcessOutcome`**

Add `was_sigterm()`, use `signal.Signals(code)` with a `ValueError` fallback to the text without a
name.

- [x] **Step 4: Run the validation**

- Run: `python -m pytest tests/unit/misc/test_guiprocess.py`
- Expected: PASS

- [x] **Step 5: Commit**

```bash
git add qutebrowser/misc/guiprocess.py tests/unit/misc/test_guiprocess.py specs/2026-10-19-qutebrowser-process-messages/plan.md
git commit -m "feat(qutebrowser-process-messages): name the signal of a crashed process"
```

## Task 2: PID suffix and quiet SIGTERM in `_on_finished`

**Files:**

- Modify: `qutebrowser/misc/guiprocess.py` (`GUIProcess._on_finished`), `doc/changelog.asciidoc`
- Test: `tests/unit/misc/test_guiprocess.py`

**Interfaces:**

- Consumes: `ProcessOutcome.was_sigterm()` and the outcome text of Task 1.
- Produces: `_on_finished` emits `"{outcome} See :process {pid} for details."`; SIGTERM: info with
  `verbose`, nothing otherwise, no cleanup timer, no stdout/stderr error log.

- [x] **Step 1: Write the failing tests**

Update `test_start_verbose`
(`Testprocess exited successfully. See :process {proc.pid} for details.`), `test_exit_unsuccessful`,
`test_exit_crash` and `test_exit_unsuccessful_output` to the suffix with the PID. Add
`test_exit_sigterm_quiet` (no messages), `test_exit_sigterm_verbose` (last message is info
`Testprocess terminated with status 15 (SIGTERM). See :process {pid} for details.`, no error
message), and `test_exit_sigterm_output` (stderr output shown, no outcome message, no error log of
stdout/stderr).

The break each test catches: the bare `:process` suffix; an error-level SIGTERM message; an outcome
message emitted before the output messages.

- [x] **Step 2: Run them to check they fail**

- Run: `python -m pytest tests/unit/misc/test_guiprocess.py`
- Expected: FAIL, text ends `See :process for details.`

- [x] **Step 3: Implement in `_on_finished`**

Append the PID suffix once; add the SIGTERM branch before the failure branch.

- [x] **Step 4: Add the changelog entry** under Changed in the unreleased section.

- [x] **Step 5: Run the validation**

- Run: `python -m pytest tests/unit/misc/test_guiprocess.py tests/unit/misc/test_editor.py`
- Expected: PASS

- [x] **Step 6: Commit**

```bash
git add qutebrowser/misc/guiprocess.py tests/unit/misc/test_guiprocess.py doc/changelog.asciidoc specs/2026-10-19-qutebrowser-process-messages/plan.md
git commit -m "feat(qutebrowser-process-messages): name the PID and quiet SIGTERM"
```
