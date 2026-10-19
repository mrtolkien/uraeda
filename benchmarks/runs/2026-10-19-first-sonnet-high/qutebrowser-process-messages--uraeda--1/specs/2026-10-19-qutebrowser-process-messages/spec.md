---
status: approved
revision: 1
clarifications: 1
risk-tier: low
plan-review: false
---

# Spec: Process message improvements

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve process messages that name the finished process's PID and the killing signal, and
>   stay silent for SIGTERM unless `--verbose`.
> - Unverified: that Qt reports the signal number as the exit code of a crashed process. The plan's
>   first task runs a SIGTERM test. If it fails, the signal story changes to match what Qt reports.
> - The process log's last entry for a failure is the outcome message. I read the proposal's
>   "process log" as qutebrowser's `procs` log.
> - A SIGTERM exit is not a success: it keeps its 1h-cleanup exclusion and skips the stdout and
>   stderr error log.
> - An unknown signal number, such as a Windows crash code, prints
>   `{What} crashed with status {code}.`, with no name.
> - No decision is created, changed, or removed. Risk tier is low, and the plan does not wait for a
>   review.

When a qutebrowser process fails or is killed, [`GUIProcess`](/qutebrowser/misc/guiprocess.py) shows
a message that ends with `See :process for details.`. That command opens the last started process,
which may not be the failing one. This feature puts the finished process's PID in the message and
the signal name in the text of a crash. It also stops reporting a SIGTERM as an error. It serves
users who spawn processes, run userscripts, or use an editor. See the [proposal](proposal.md), the
[discovery](discovery-01.md), and the [clarifications](clarifications-01.md).

## Decisions

This spec creates, changes, or removes no decision.

Relied on: none. The ledger in `specs/decisions/` has no decision yet.

## User stories

### US1: A failure points to the right process (P1)

A user sees an error for a process that failed, and the message names the PID of that process.
Running `:process <pid>` from the message opens the right one.

Key scenarios:

1. **Given** a `Testprocess` with PID 1234 that exits with code 1, **When** it finishes, **Then**
   one error message reads `Testprocess exited with status 1. See :process 1234 for details.`
2. **Given** the same failed exit, **When** it finishes, **Then** the last entry of the process log
   is that same text.
3. **Given** a process with PID 1234 exiting with code 0 and `--verbose` set, **When** it finishes,
   **Then** one info message reads `Testprocess exited successfully. See :process 1234 for details.`

More scenarios:

1. **Given** a successful exit without `--verbose`, **When** it finishes, **Then** no message is
   emitted, as today.
2. **Given** a failed exit that wrote `oops` to stderr, **When** it finishes, **Then** the outcome
   message is the last message emitted, after the output message.

### US2: A crash names its signal (P2)

A user whose process was killed by a signal reads the signal's name and number in the message,
instead of a bare "crashed".

Key scenarios:

1. **Given** a `Testprocess` with PID 1234 killed by `SIGSEGV`, **When** it finishes, **Then** its
   outcome text is `Testprocess crashed with status 11 (SIGSEGV).`, and one error message adds
   ` See :process 1234 for details.`
2. **Given** a `Testprocess` killed by `SIGTERM`, **When** its `state_str()` is read, **Then** it
   returns `terminated`.
3. **Given** a `Testprocess` killed by `SIGSEGV`, **When** its `state_str()` is read, **Then** it
   returns `crashed`.

More scenarios:

1. **Given** a crash with code 4242, which is no signal number, **When** it finishes, **Then** the
   outcome text is `Testprocess crashed with status 4242.`, and `state_str()` returns `crashed`.

### US3: A SIGTERM is quiet unless verbose (P2)

A user who ends a process, for example with `:process terminate`, gets no error. With `--verbose`,
they get an info message instead.

Key scenarios:

1. **Given** a `Testprocess` with PID 1234 killed by `SIGTERM` and no `--verbose`, **When** it
   finishes, **Then** no message of any level is emitted.
2. **Given** the same process with `--verbose`, **When** it finishes, **Then** the last emitted
   message is the info message
   `Testprocess terminated with status 15 (SIGTERM). See :process 1234 for details.`
3. **Given** the same process, **When** its outcome is read, **Then** `was_successful()` is false
   and the text is the terminated form, not `Testprocess exited successfully.`

## Architecture

The change stays in one file, which already builds every outcome text. The
[discovery](discovery-01.md#the-proposals-path-and-existing-actions) found that `ProcessOutcome`
owns the text and `GUIProcess._on_finished` owns the messages. Both stay as they are, with new
rules.

- **`ProcessOutcome`** in [`guiprocess.py`](/qutebrowser/misc/guiprocess.py) owns the outcome text
  and the state names. It names the signal with Python's `signal.Signals`, so it owns the
  unknown-number rule. It adds `terminated` to `state_str()`, which the
  [`:process` completion](/qutebrowser/completion/models/miscmodels.py) shows.
- **`GUIProcess._on_finished`** owns what is emitted and logged. It appends
  ` See :process {self.pid} for details.` to the outcome. It treats SIGTERM like a success for
  messages only: info with `--verbose`, silence otherwise.

Tradeoffs:

- Two meanings of "success": `was_successful()` stays false for SIGTERM, so the editor still treats
  it as a failure, and `_on_finished` has a separate SIGTERM branch.
- On Windows, a crash code of 15 would be read as SIGTERM, though it is an exception code.

## Edge cases

| Importance | Situation                                          | What happens                                                                         |
| ---------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| High       | A failing process is not the last one started      | The message carries the failing process's own PID, so `:process` opens the right one |
| Normal     | A crash code is no known signal number             | The text is `{What} crashed with status {code}.`, with no name                       |
| Normal     | A SIGTERM exit                                     | No cleanup after 1h, and no error log of its stdout and stderr                       |
| Normal     | A failed exit with `--verbose` set                 | Still an error message, with the PID suffix                                          |
| Normal     | A SIGTERM exit with output and `--verbose` not set | The output messages are shown as today, and no outcome message follows               |
| Niche      | A Windows crash code of 15                         | Read as SIGTERM: quiet, and `terminated`                                             |

## Success criteria

- **SC-001** (one PID per message): every finished-process message of `GUIProcess` ends with
  `See :process {pid} for details.` with the finished process's own PID.
- **SC-002** (no SIGTERM error): a SIGTERM exit emits no error-level message, with or without
  `--verbose`.
- **SC-003** (signal name): a crash by a known signal shows `({signal_name})` and its number in the
  text.
- **SC-004** (tests): every scenario above has a test, and the four tests with the old text are
  updated.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. The human accepted the scope as proposed, and added no note. Settled while writing
this spec:

- **The process log** is read as qutebrowser's `procs` log: the outcome message is logged there at
  error level, after the stdout and stderr entries. A SIGTERM exit logs nothing at error level.
- **The repeated requirements** of the proposal agree, so each is built once. Both `{What}` and
  `{process}` mean the capitalized label.
- **A SIGTERM** is a crash exit whose code is 15. Other crash exits are `crashed`.
- **The changelog entry** goes under Changed in [`doc/changelog.asciidoc`](/doc/changelog.asciidoc).

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Low**: no data format, no new interface, and one file of messages, with its tests.
