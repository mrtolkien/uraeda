---
status: answered
---

# Clarifications, round 01: Process messages

> [!NOTE]
>
> Answered on 2026-10-19.
>
> - Verdict: worth building as proposed, because it is small, contained in one file, and fully
>   specified.
> - Scope: the proposal repeats its requirements, and the spec will state each one once.
> - Signals without a name: the proposal gives no text for a crash code Python cannot name.
> - SIGTERM cleanup: a SIGTERM exit is also cleaned up after 1 hour, like a success.
> - Online research: none was done, as the proposal forbids looking up existing solutions.

## Context

### Goal

When a process spawned by qutebrowser ends, its message should name the right process, stay silent
for SIGTERM unless `--verbose`, and name the signal for a crash.

### Today

[`GUIProcess._on_finished`](/qutebrowser/misc/guiprocess.py) shows
`<outcome> See :process for details.` as an error for every exit that is not successful. The command
`:process` without a PID shows the last process started, so the message can point at the wrong one.
A SIGTERM exit is an error, and a signal exit says only `crashed`.

### Scope

It covers the outcome texts, the `terminated` state, the PID in the message, the silent SIGTERM
exit, and the last log entry of a failed exit. It adds no interface and no command change.

### Sources

- The code: [guiprocess.py](/qutebrowser/misc/guiprocess.py),
  [test_guiprocess.py](/tests/unit/misc/test_guiprocess.py),
  [miscmodels.py](/qutebrowser/completion/models/miscmodels.py).
- The full investigation is in [discovery](discovery-01.md).

## Q1: Do you confirm the scope below?

The proposal fixes the wrong PID, the SIGTERM error, and the missing signal name, all inside
`GUIProcess`. It lists its requirements twice, with the same content, and the spec will keep each
once. Nothing else needs your decision: the settled points below cover the gaps. More in
[discovery](discovery-01.md#scope).

Why it matters: it fixes the work to the proposal's text, and nothing beyond it.

- **A (recommended). Go ahead with exactly the proposal's requirements, with the gaps settled as
  listed under "Settled without the human".**
  - [pro] it matches the proposal and the constitution, and adds nothing.
  - [con] `:process` without a PID still shows the last process started.
  - Why recommended: the message now names the right PID, so the command's default does not hurt.
- **B. Also make `:process` without a PID show the most recent failed process.**
  - [pro] the command matches the failure message's intent.
  - [con] it goes beyond the proposal, and changes a command the proposal leaves alone.

**Answer:** A — exactly the proposal's requirements, nothing beyond.

## Settled without the human

### Check these

- **A SIGTERM exit is cleaned up after 1 hour** like a success, since it is treated as one for
  messages. `was_successful()` stays false. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Signals Python cannot name** keep the old text, `<What> crashed.`, so no name is invented. This
  covers Windows crash codes. See [discovery](discovery-01.md#signals-without-a-name).

### Behaviour

- **A SIGKILL exit** gives `<What> crashed with status 9 (SIGKILL).` as an error, as every signal
  other than SIGTERM does. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The `terminated` state** shows in the `:process` completion and sorts with the unsuccessful
  processes. See [discovery](discovery-01.md#important-reads).

### Under the hood

- **The failure text goes to the process log last**, after the stdout and stderr dumps. See
  [discovery](discovery-01.md#final-emitted-message-and-final-entry-of-the-process-log).
- **A SIGTERM exit logs no stdout or stderr dump**, as for a success, and emits no error.
- **The Qt crash code** is checked as the signal number by the plan's first task. See
  [discovery](discovery-01.md#qts-exit-status-and-code).

**Notes:**
