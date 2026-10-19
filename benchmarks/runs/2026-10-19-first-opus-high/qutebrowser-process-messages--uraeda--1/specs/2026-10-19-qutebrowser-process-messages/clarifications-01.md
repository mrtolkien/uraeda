---
status: answered
---

# Clarifications, round 01: Process messages

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building as proposed: one module changes, and Qt's signal numbers were checked on
>   Linux.
> - What a stop with SIGTERM shares with a success, besides the message: the error lines in the log,
>   and the 1-hour cleanup. The proposal's two copies of this rule disagree.
> - A kill with SIGKILL, from `:process <pid> kill`, will still show an error.
> - The code-quality decision lasts beyond this feature.
> - Check the settled point on signals with no name, on Windows.

## Context

### Goal

The [proposal](proposal.md) asks for clearer messages when a process started by qutebrowser
finishes. The message names the PID (process ID) of that process. A stop with SIGTERM stays quiet
unless `--verbose` was given. A process killed by a signal names it, like `(SIGSEGV)`.

### Today

[`GUIProcess._on_finished`](/qutebrowser/misc/guiprocess.py) shows the outcome of every process run
by `:spawn`, userscripts, the editor, and file pickers.

| How it ended             | Message today                                                   | With the proposal                                                         |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| exit code 0, `--verbose` | info `Command exited successfully.`                             | info `Command exited successfully. See :process 1234 for details.`        |
| exit code 1              | error `Command exited with status 1. See :process for details.` | error, same text with `:process 1234`                                     |
| SIGSEGV                  | error `Command crashed. See :process for details.`              | error `Command crashed with status 11 (SIGSEGV). See :process 1234 ...`   |
| SIGTERM, no `--verbose`  | error `Command crashed. See :process for details.`              | nothing                                                                   |
| SIGTERM, `--verbose`     | the same error                                                  | info `Command terminated with status 15 (SIGTERM). See :process 1234 ...` |

`:process` without a PID opens the last _started_ process, which may not be the one that failed.

### Scope

The outcome text, its short state in the `:process` completion, and the message `_on_finished`
shows. `was_successful()` stays false for SIGTERM, as the proposal says. The `:process` command
itself is unchanged.

### Sources

- [`guiprocess.py`](/qutebrowser/misc/guiprocess.py), [`editor.py`](/qutebrowser/misc/editor.py),
  the [completion](/qutebrowser/completion/models/miscmodels.py), and their tests.
- Qt's [QProcess](https://doc.qt.io/qt-6/qprocess.html) and Python's
  [signal](https://docs.python.org/3.10/library/signal.html) documentation.
- An experiment with the installed PyQt6, killing children with signals.
- systemd's
  [`SuccessExitStatus=`](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html).
- The full investigation is in [discovery](discovery-01.md).

## Q1: Besides the message, what does a SIGTERM stop share with a successful exit?

A successful exit does three things in `_on_finished`. It shows no error. It does not copy the
process's stdout and stderr into the log at error level. It starts a timer that drops the process's
data after 1 hour, after which `:process <pid>` says "Data for process ... got cleaned up".

A failed exit does the opposite on all three: error, output logged at error level, data kept until
qutebrowser quits. The proposal settles only the first. One copy of its rule says "only for GUI
messaging", the other "for messaging purposes".

systemd counts a SIGTERM stop as a clean exit altogether. qutebrowser cannot tell a
`:process terminate` from a SIGTERM sent from outside, such as at system shutdown. More in
[discovery](discovery-01.md#reach-of-the-sigterm-exception).

Why it matters: it decides whether terminated processes fill the log with error lines, and whether
their data piles up in the `:process` completion until restart.

- **A (recommended). Only the message changes: a SIGTERM stop still logs its output at error level,
  and its data stays until qutebrowser quits.**
  - [pro] the proposal's "only for GUI messaging", literally; the smallest change.
  - [con] a terminated process with output still writes error lines to the log.
  - Why recommended: the constitution asks to go no further than the proposal, and this is its
    stricter wording.
- **B. The message and the output logging change: a SIGTERM stop logs nothing at error level, and
  its data stays until qutebrowser quits.**
  - [pro] a requested stop leaves no error anywhere.
  - [con] when a stop was not requested, its output is no longer in the log.
- **C. A SIGTERM stop behaves like a success everywhere except `was_successful()`: no error-level
  log, and its data is dropped after 1 hour.**
  - [pro] like systemd; terminated processes do not pile up.
  - [con] goes beyond "only for GUI messaging"; the `:process` docstring, which names successful
    exits, changes too.

**Answer:** Your call, taking A: only the message changes

## Q2: Should a kill with SIGKILL stay an error?

`:process <pid> kill` sends SIGKILL on Unix. With the proposal, it shows an error such as
`Command crashed with status 9 (SIGKILL). See :process 1234 for details.` The proposal only quiets
SIGTERM.

SIGKILL is also what Linux's out-of-memory killer sends. qutebrowser cannot tell it from a user's
kill. systemd counts SIGKILL as a failure. More in [discovery](discovery-01.md#sigkill).

Why it matters: it decides whether a forced kill by the system can go unnoticed.

- **A (recommended). Keep the error for SIGKILL, as proposed; only SIGTERM is quiet.**
  - [pro] a process killed by the system is still reported.
  - [con] a user who runs `:process <pid> kill` sees an error for their own action.
  - Why recommended: it follows the proposal, and keeps a forced kill visible.
- **B. Quiet SIGKILL too, like SIGTERM, with the same `--verbose` info.**
  - [pro] no error after a user's own kill.
  - [con] an out-of-memory kill goes unnoticed; adds a case the proposal does not ask for.

**Answer:** A: keep the error for SIGKILL, only SIGTERM is quiet

## Q3: Should the hint for long output also name the PID?

When a process prints more than 20 lines and output messages are on, the message starts with
`[N lines hidden, see :process for the full output]`. It has the same flaw as the outcome message:
`:process` alone opens the last started process. The proposal does not mention it. More in
[discovery](discovery-01.md#pointer-in-the-hidden-lines-hint).

Why it matters: the same misdirection stays in one message, against the constitution's rule to add
nothing the proposal does not ask for.

- **A (recommended). Leave the hint as it is, and note it in the inbox for a later change.**
  - [pro] stays within the proposal.
  - [con] the hint can still point to the wrong process.
  - Why recommended: the constitution forbids going beyond the proposal; the inbox keeps the flaw
    for a change of its own.
- **B. Write the PID in the hint too: `see :process 1234 for the full output`.**
  - [pro] every pointer to `:process` names the right process.
  - [con] goes beyond the proposal.

**Answer:** Your call, taking A

## Q4: Should the project record its code-quality limits as a decision?

The project has no code-quality decision, the file that tells agents the limits code must respect.
Its linters already set some: [`.pylintrc`](/.pylintrc) allows at most 10 arguments per function and
190 characters per line. [`.flake8`](/.flake8) caps the complexity of a function at 12. This feature
meets them. More in [discovery](discovery-01.md#code-quality-decision).

Why it matters: the decision binds every later feature and change; it is asked once.

- **A (recommended). Record the limits the linters already set, without changing their
  configuration.**
  - [pro] agents follow the project's own limits; no new marker in the code.
  - [con] no limit on function or file length.
  - Why recommended: it writes down what already holds, without touching linters this task is not
    about.
- **B. Record that the project has no Uraeda limits, and revisit in 6 months.**
  - [pro] no decision to maintain.
  - [con] agents learn the linters' limits only when they fail.
- **C. Add limits on function and file length to pylint, with today's offenders marked.**
  - [pro] keeps functions and files from growing.
  - [con] touches many files unrelated to this feature.

**Answer:** Your call, taking A

## Settled without the human

### Check these

- **Signals with no name** are shown without the parenthesis: `Command crashed with status -1.` A
  Windows crash code, or a number Python does not know, has no signal name, and looking it up would
  raise an error. See [discovery](discovery-01.md#signals-with-no-name).
- **SIGTERM on Windows** is not covered: Qt's `terminate()` asks Windows programs to close, and they
  exit normally with their own code. See
  [discovery](discovery-01.md#qts-qprocess-qt-651-pyqt6-650-installed).
- **A shell exiting with 143** after its child got SIGTERM stays a failure: the shell exited
  normally, and only its code says why. See
  [discovery](discovery-01.md#what-qt-does-on-a-signal-checked).

### Behaviour

- **The editor stopped by SIGTERM** shows no error any more, but still shows its info "Keeping file
  ... as the editor process exited abnormally", so an edit is never lost silently. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The `:process` completion** shows `terminated` for a SIGTERM stop, and sorts it with the failed
  ones, since `was_successful()` stays false. See [discovery](discovery-01.md#needs-no-choice).
- **The `qute://process` page** shows the new outcome text as the status, unchanged otherwise.
- **`--verbose`** means the existing flag of `:spawn -v`, `:spawn -u -v`, and `:hint ... spawn -v`,
  the only callers that set it.
- **The order of messages** stays: output messages first, the outcome last, as the proposal asks.

### Under the hood

- **"The process log"** of the proposal is read as the captured log: `message.error` already writes
  its text there, after the output lines. See [discovery](discovery-01.md#the-process-log).
- **The signal name** comes from Python's `signal.Signals(code).name`, with no new dependency.
- **The end-to-end tests** expecting `Command exited successfully.` match the new text with
  `See :process * for details.`, since the PID changes per run.
- **The changelog** gets an entry in its unreleased section, as every user-visible change there
  does.

**Notes:**
