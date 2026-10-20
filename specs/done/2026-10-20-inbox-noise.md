---
kind: change
finished: 2026-10-20
pull-request: https://github.com/mrtolkien/uraeda/pull/49
---

# Record: Fix agent -> inbox flow, it creates way too much noise at the moment

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-10-20, finished on
> 2026-10-20, in [its pull request](https://github.com/mrtolkien/uraeda/pull/49). Its full files are
> in git: `git log -- specs/changes/2026-10-20-inbox-noise/`.

## What and why

Agents noted every problem met outside a task, and every minor review finding under **Deferred
fixes**: 43 agent notes waited in the inbox, most of them small issues in the feature's own code.
The human wants a note to be exceptional: either a finding matters and is part of the pull request,
or it does not and goes nowhere. A note is only for an important issue that needs the human and
clearly falls outside the current feature.

## Behaviour

- A review's findings are graded first: a critical or important one is fixed or ruled on, never
  dropped. Minor findings, at a wave review, the final review, or a second reviewer's, are fixed in
  the same pass when worth it, and otherwise dropped. None reaches the inbox.
- Anything else an agent finds goes one of three ways. What the work needs, a problem in the
  behaviour it builds, the code it writes, or one it cannot ship without, is fixed on the branch and
  named in the pull request. What passes two tests is a note: it is important, and it needs the
  human because it clearly falls outside the feature or change. The rest is dropped, written
  nowhere.
- A problem already there in code the branch touches is not the work's. A failure the validation
  shows, like a flaky test, is reported in the pull request, a change's included.
- During discovery, a problem that changes what the feature should be is asked in the round.
- The **Deferred fixes** category and its pull request section are gone. The note's format, its
  marks, `ura note --agent`, and writing it in the agent's own worktree are unchanged.

## Design

The rule lives in [agents' notes](/skills/uraeda/references/inbox.md#agents-notes). The
[implementation](/skills/uraeda/references/implementation.md#grade-the-findings),
[change](/skills/uraeda/references/change.md#making-the-change),
[discovery](/skills/uraeda/references/discovery.md), and
[finish](/skills/uraeda/references/finish.md) steps link it instead of sending findings to the
inbox. The record template's **Follow-ups** lists the agents' notes. The example's deferred finding
is gone from its inbox and its record, and its slow-save note says why it passes the tests.
