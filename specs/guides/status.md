# Status and checks

How `ura` works out where a feature stands, and how that should read. The
[Feature status](../decisions/feature-status.md) decision holds what never bends. This guide says
what it aims at. Read it before a feature that reads a branch's step, shows a status in
`ura status`, `ura next`, or `ura serve`'s pages, or adds a rule to `ura check`.

## What the human asked for

> "Generally the repo parsing must be ROBUST, ACCURATE, and FAST. If there are actually ambiguous
> states to manage, ask me. But overall it should be pretty simple and focus on the committed state
> of all worktrees."

The complaint behind every fix since was the same: "Overall it's all very faulty, laggy, and
sometimes just wrong." A status is trusted or it is useless, so it is right before it is clever. An
ambiguous state is a question for the human, never a guess shown as a fact.

## Read each worktree, from what is committed

A feature is in progress where a worktree holds it, and its step is read from that worktree. The
commit is the base, and the human made reading it a habit on purpose, not a rule:

> "this is not a MUST because we want the "step detection" to work even in weird corner cases and be
> extremely robust. git is a bit too slow for that."

So a faster or sturdier reading may lay over the commit when it cannot be wrong. There is one today:
the human's work, which waits uncommitted in the worktree. A round they set `answered`, or a spec
they approved, moves the step at once, and `ura next` says to commit it first. A file an agent is
still writing moves nothing until it is committed.

## Never early

> "wait for agent runs to _fully_ finish (including sub-agents or background comments) before saying
> it's "waiting on you" … make sure the "PR ready" state means the PR was opened"

A status never says more than is true. "Waiting on you" means the human can act now, on the latest
work. A pull request with commits still to push, or behind the default branch, is the agent's step:
`push` or `catch-up`. `ura` sees no agent's session, so it never says one is running: the files and
the pull request say whose turn it is, and an agent's step ends with its commit.

## What each status tells the human

- **Who it waits on comes first**: `ura status` says "you" or "agent" on each line, and
  `ura serve`'s home lists only what waits on the human, across repositories, in the human's words:
  "Needs you is more important than In Progress".
- **Labels are short**: "Rewrite status messages to be shorter to go with it: "Spec ready", "PR
  ready", ..."
- **Without `gh`, it says so**, rather than guess a pull request's state.

## Checks: problems and warnings

> "Generally we don’t really care about small problems to proposal + our flow should not create
> errors."

`ura check` finds what is wrong in the workflow's files. Most of it is drift: a missing heading, a
link to a moved file, a file an agent is still writing. The human asked that those stop reading as
the feature's fault: "right now features in dev very often show up as having “problems” when they
don’t".

- **A new check is a warning**, unless the workflow cannot go on without a fix. That is a habit for
  whoever writes the check, and the decision's last rule is the limit behind it.
- **An error Uraeda's own flow produced is a bug of the flow.** Fix what wrote the file, not the
  file, and never teach the human to ignore the error.
- **In a terminal, `ura check` reports every result as it is**, warnings included, so agents keep
  seeing format slips.
