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
> - You approve process messages that name the PID and the signal of a crash, and stay quiet after a
>   SIGTERM stop without `--verbose`.
> - New decision, Code quality: the limits pylint and flake8 already set become binding for agents.
> - A SIGTERM stop changes only the message, as you chose. Its output still goes to the log at error
>   level, and its data stays until qutebrowser quits.
> - Read one way: "no message of any level" covers the outcome message. Output asked for with
>   `:spawn -m` still shows, stderr in red. Say so if you meant to hide it too.
> - Unverified on macOS: Qt giving a crash's signal number as its exit code, checked on Linux only.
>   The plan's first task checks it. If macOS differs, its crashes show a wrong or no signal name.
> - Risk tier `low`: messages only, no stored data. The plan goes straight to the implementation.

When a process started by qutebrowser finishes, its message points to that process by its PID. A
crash names the signal that killed the process. A process stopped with SIGTERM shows nothing, unless
it was started with `--verbose`. This serves anyone who runs `:spawn`, userscripts, the external
editor, or a file picker. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Decisions

- **New: [Code quality](../decisions/code-quality.md)**. Lines stay within 190 characters, functions
  within 10 arguments and a complexity of 12, as pylint and flake8 already check.

Relied on: none, the ledger has no active decision yet.

## User stories

The scenarios use the proposal's examples: a process labelled `testprocess`, running with PID 1234.
`:spawn` labels its processes `command`, so users read "Command ...". Every message below is the
process's last one: output messages, when `:spawn -m` asked for them, come before it.

### US1: Find the process that finished (P1)

A user whose command fails reads an error naming its PID, and opens it with `:process 1234`, even
when another process started since. With `--verbose`, a success names its PID the same way.

[Failed exit](mockups/messages.html#failure)

Key scenarios:

1. **Given** a `testprocess` running with PID 1234, **When** it exits with code 1, **Then**
   qutebrowser shows the error `Testprocess exited with status 1. See :process 1234 for details.`,
   **And** that text is the last entry of the log for this exit.
2. **Given** a `testprocess` started with `--verbose`, running with PID 1234, **When** it exits with
   code 0, **Then** qutebrowser shows the info
   `Testprocess exited successfully. See :process 1234 for details.`
3. **Given** a process with PID 1234 and a later one with PID 5678, both running, **When** the first
   exits with code 1, **Then** its error ends with `See :process 1234 for details.`

More scenarios:

1. **Given** a `testprocess` started without `--verbose`, **When** it exits with code 0, **Then**
   qutebrowser shows no message, as today.

### US2: Know which signal killed a process (P1)

A process killed by a signal reports the signal's number and name in its error, and `:process` shows
the same text as its status.

[Crash](mockups/messages.html#crash)

Key scenarios:

1. **Given** a `testprocess` running with PID 1234, **When** it is killed by SIGSEGV, **Then**
   qutebrowser shows the error
   `Testprocess crashed with status 11 (SIGSEGV). See :process 1234 for details.`
2. **Given** a `testprocess` running with PID 1234, **When** `:process 1234 kill` sends it SIGKILL,
   **Then** qutebrowser shows the error
   `Testprocess crashed with status 9 (SIGKILL). See :process 1234 for details.`
3. **Given** a `testprocess` killed by SIGSEGV, **When** the `:process` completion lists it,
   **Then** its state is `crashed`.

More scenarios:

1. **Given** a finished `testprocess` whose exit was a crash with code -1, **When** its outcome is
   shown, **Then** it reads `Testprocess crashed with status -1.`, without a signal name.

### US3: Stop a process without an error (P1)

A user who stops a process with `:process 1234 terminate`, or anything else sending SIGTERM, sees no
error. With `--verbose`, an info says how it ended.

[Stop without `--verbose`](mockups/messages.html#sigterm)

[Stop with `--verbose`](mockups/messages.html#sigterm-verbose)

Key scenarios:

1. **Given** a `testprocess` started without `--verbose`, running with PID 1234, **When** it is
   killed by SIGTERM, **Then** qutebrowser shows no message of any level about its exit.
2. **Given** a `testprocess` started with `--verbose`, running with PID 1234, **When** it is killed
   by SIGTERM, **Then** its last message is the info
   `Testprocess terminated with status 15 (SIGTERM). See :process 1234 for details.`, **And** no
   error is shown.
3. **Given** a `testprocess` killed by SIGTERM, **When** its outcome is read, **Then** its text is
   `Testprocess terminated with status 15 (SIGTERM).`, its state is `terminated`, **And** it does
   not count as successful.

More scenarios:

1. **Given** a `testprocess` printing `oops` on stderr, **When** it is killed by SIGTERM, **Then**
   the log still gets `Process stderr:` and `oops` at error level, **And** `:process 1234` still
   shows its data after 1 hour.
2. **Given** the external editor, **When** it is killed by SIGTERM, **Then** qutebrowser shows no
   error, **And** still shows the info that it keeps the temporary file.

## Architecture

The change stays in [`guiprocess.py`](/qutebrowser/misc/guiprocess.py), in the two places that own
these rules today. No public function, class, or method is added, as the proposal says. See
[the code](discovery-01.md#important-reads) and
[who owns each rule](discovery-01.md#rules-and-their-owners).

- **The SIGTERM test**, a function private to the module, says whether an exit was a crash with code
  SIGTERM. It owns the SIGTERM rule: the outcome and the finish handler both ask it.
- **The process outcome**, `ProcessOutcome`, builds the outcome text and the short state. It owns
  the signal name, from Python's `signal.Signals`, left out when the code is no known signal.
  `was_successful()` is unchanged: false for any crash.
- **The finish handler**, `GUIProcess._on_finished`, picks the message. It owns the pointer
  `See :process <pid> for details.`, added to every outcome message. A success or a SIGTERM stop
  shows an info only with `--verbose`; anything else shows an error. Output logging and the 1-hour
  cleanup still follow `was_successful()` alone.

The `:process` completion and the `qute://process` page show the new state and text without a change
of their own. The end-to-end tests expecting `Command exited successfully.` now expect
`Command exited successfully. See :process * for details.`, since the PID changes per run.

Tradeoffs:

- A SIGTERM sent from outside qutebrowser, at system shutdown for example, is quiet too: Qt does not
  say who sent it.
- A terminated process with output still writes error lines to the log.

## Edge cases

| Importance | Situation                                                  | What happens                                                                |
| ---------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| High       | The external editor is stopped with SIGTERM                | no error; the temporary file is kept, and its info says so                  |
| Normal     | A shell exits with 143 after its child got SIGTERM         | a failure: `Command exited with status 143. See :process 1234 for details.` |
| Normal     | `:spawn -m` on a process stopped with SIGTERM, with stderr | the output messages show as today, stderr as an error; no outcome message   |
| Normal     | `:process` without a PID                                   | opens the last started process, as today                                    |
| Normal     | Output over 20 lines, with `:spawn -m`                     | its hint still reads `see :process for the full output`, without a PID      |
| Niche      | A crash code that is no signal Python knows, like -1       | the outcome leaves out the parenthesis: `Command crashed with status -1.`   |
| Niche      | `:process 1234 terminate` on Windows                       | Windows asks the program to close; it exits with its own code, as today     |

## Success criteria

- **SC-001** (the right PID): Every outcome message names the PID of the process that finished, not
  of the last one started.
- **SC-002** (quiet stop): A SIGTERM stop without `--verbose` shows no message of any level.
- **SC-003** (named signals): A crash by SIGSEGV, SIGKILL, SIGABRT, or SIGTERM names its signal in
  the outcome.

## Assumptions

The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as
written there. Settled while writing this spec:

- **Output messages after a SIGTERM stop** stay as `:spawn -m` shows them today. "No message of any
  level" is read as the outcome message: the output is what the user asked to see.
- **The long-output hint** stays as it is, as you chose; it is noted in the inbox for a later
  change.
- **The changelog entry** lists the three message changes under the unreleased v3.0.0's "Changed".
- **The mockup** shows qutebrowser's default message colors; the spec's text wins over it.

## Constitution check

| I. Humans stay in control | II. Requirements come from the task | III. Code is checked and stays maintainable |
| ------------------------- | ----------------------------------- | ------------------------------------------- |
| ✅                        | ✅                                  | ✅                                          |

## Risk tier

**Low**: message text only, in one module, with no stored data, file format, or interface changed.
