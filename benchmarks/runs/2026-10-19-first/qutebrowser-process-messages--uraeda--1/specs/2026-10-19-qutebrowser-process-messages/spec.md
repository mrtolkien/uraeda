---
status: approved
revision: 1
clarifications: 1
risk-tier: low
plan-review: false
---

# Spec: Process messages

> [!NOTE]
>
> Approved on 2026-10-19.
>
> - You approve new exit messages for processes: the right PID, silence for SIGTERM unless
>   `--verbose`, and the signal name for a crash.
> - No decision is created, changed, or removed.
> - Signals Python cannot name keep the old text, `<What> crashed.`: no name is invented.
> - A SIGTERM exit is also cleaned up after 1 hour, like a success, while `was_successful()` stays
>   false.
> - Unverified: that Qt reports the signal number as the exit code on Unix. The plan's first task
>   checks it. If it fails, the signal text needs another source for the number.
> - Risk tier `low`: no stored data, no new interface, no relaxed guard.

When a process spawned by qutebrowser ends, `GUIProcess` should name the right process, stay silent
for a SIGTERM exit unless `--verbose` is set, and name the signal for a crash. It serves anyone who
runs `:spawn` or an editor or userscript. See the [proposal](proposal.md), the
[discovery](discovery-01.md), and the [clarifications](clarifications-01.md).

## Decisions

No decision is created, changed, or removed. The ledger has no active decision that applies.

## User stories

### US1: A failure names the right process (P1)

A user whose process fails reads an error that ends in `See :process <pid> for details.`, with the
PID of that process, so `:process <pid>` opens the right one even if another process started later.

Key scenarios:

1. **Given** a `Testprocess` with PID 1234 that exits with status 1, **When** it finishes, **Then**
   the error `Testprocess exited with status 1. See :process 1234 for details.` is shown.
2. **Given** the same failed exit, **When** it finishes, **Then** that same text is the last entry
   of the process log, after the stdout and stderr dumps.
3. **Given** a second process started after the failing one, **When** the first fails, **Then** the
   message still names the first process's PID.

### US2: A SIGTERM exit stays quiet (P1)

A user who ends a process with `:process terminate` sees no error. With `--verbose`, they see an
info message instead.

Key scenarios:

1. **Given** a `Testprocess` killed by SIGTERM, without `--verbose`, **When** it finishes, **Then**
   no message of any level is emitted.
2. **Given** a `Testprocess` with PID 1234 killed by SIGTERM, with `--verbose`, **When** it
   finishes, **Then** the info message
   `Testprocess terminated with status 15 (SIGTERM). See :process 1234 for details.` is the last
   message emitted, and no error is emitted.

### US3: A crash names its signal (P1)

A user whose process is killed by a signal other than SIGTERM reads the signal in the error.

Key scenarios:

1. **Given** a `Testprocess` with PID 1234 killed by SIGSEGV, **When** it finishes, **Then** the
   error `Testprocess crashed with status 11 (SIGSEGV). See :process 1234 for details.` is shown.
2. **Given** a `Testprocess` killed by SIGKILL, **When** it finishes, **Then** the outcome is
   `Testprocess crashed with status 9 (SIGKILL).`, shown as an error.

### US4: A verbose success names its process (P2)

Key scenarios:

1. **Given** a `Testprocess` with PID 1234 that exits successfully, with `--verbose`, **When** it
   finishes, **Then** the info message
   `Testprocess exited successfully. See :process 1234 for details.` is shown.

More scenarios:

1. **Given** a successful exit without `--verbose`, **When** it finishes, **Then** no message is
   shown, as today.
2. **Given** a process killed by SIGTERM, **When** `:process` completion lists it, **Then** its
   state reads `terminated`, sorted with the unsuccessful processes.
3. **Given** a crash code Python cannot name, **When** the process finishes, **Then** the outcome is
   `Testprocess crashed.`

## Architecture

All the change sits in [`guiprocess.py`](/qutebrowser/misc/guiprocess.py), because it owns the
outcome text and the messages. The [completion model](/qutebrowser/completion/models/miscmodels.py)
and [`process.html`](/qutebrowser/html/process.html) show the new text and state unchanged. The
approach reuses the existing outcome class, and adds no interface, as the proposal asks.

- **The process outcome** (`ProcessOutcome`) builds the outcome text and the state. It owns the
  texts `<What> exited successfully.`, `<What> exited with status <code>.`, and
  `<What> <state> with status <code> (<signal>).`. `state_str()` returns `terminated` for SIGTERM
  and `crashed` for another signal. `was_successful()` stays false for SIGTERM. A code Python cannot
  name gives `<What> crashed.`
- **The finish handler** (`GUIProcess._on_finished`) owns the suffix
  `See :process <pid> for details.`, with the PID of the finished process, and the choice of
  message. It treats a SIGTERM exit like a success for messages and for the 1-hour cleanup. It logs
  the failure text last.

Tradeoffs:

- `:process` without a PID still shows the last process started: the message names the PID, so the
  default does not mislead.
- A SIGTERM exit is not recorded as a failure in any message, even if the process was killed by
  another program, not by the user.

## Edge cases

| Importance | Situation                                  | What happens                                                |
| ---------- | ------------------------------------------ | ----------------------------------------------------------- |
| High       | A second process starts before one fails   | The message names the failed process's own PID              |
| High       | A SIGTERM exit without `--verbose`         | No message, and no stdout or stderr dump in the log         |
| Normal     | A SIGKILL, as from `:process kill`         | `crashed with status 9 (SIGKILL)`, shown as an error        |
| Normal     | A failed exit with output messages enabled | The output messages come first, the failure text comes last |
| Niche      | A crash code Python cannot name (Windows)  | The outcome stays `<What> crashed.`, with no signal name    |
| Niche      | An editor process ends by SIGTERM          | The editor acts as today, as `was_successful()` is false    |

## Success criteria

- **SC-001** (right PID): Every failure and verbose message ends in
  `See :process <pid> for details.` with the finished process's PID.
- **SC-002** (silent SIGTERM): A SIGTERM exit emits no message without `--verbose`, and only an info
  message with it.
- **SC-003** (signal name): Every signal exit Python can name shows its number and name.
- **SC-004** (tests): Every scenario above has a test, and the updated texts pass in the existing
  [process tests](/tests/unit/misc/test_guiprocess.py) and
  [completion test](/tests/unit/completion/test_models.py).

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. The human confirmed exactly the proposal's requirements, and nothing beyond. Settled
while writing this spec:

- The proposal states each requirement twice with the same content. The spec states each once.
- The changelog entry in [`doc/changelog.asciidoc`](/doc/changelog.asciidoc) is left to the plan,
  following the file's habit.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Low**: message texts only, with no stored data, no new interface, and no relaxed guard.
