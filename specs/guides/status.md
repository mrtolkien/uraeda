# Status and checks

How Uraeda works out where a feature stands, and how that should read. The
[Feature status](../decisions/feature-status.md) decision holds what never bends: one place decides,
a running agent reads as working, a failure asks until dismissed, and only what stops the workflow
is a problem. This guide says what those aim at. Read it before a feature that reads a branch's
step, shows a status, or adds a rule to `ura check`.

## What the human asked for

> "Generally the repo parsing must be ROBUST, ACCURATE, and FAST. If there are actually ambiguous
> states to manage, ask me. But overall it should be pretty simple and focus on the committed state
> of all worktrees."

The complaint behind every fix since was the same: "Overall it's all very faulty, laggy, and
sometimes just wrong." A status is trusted or it is useless, so it is right before it is clever. An
ambiguous state is a question for the human, never a guess shown as a fact.

## Read what is committed, as a habit

A branch's step is read from its latest commit. That is a habit, and the human made it one on
purpose:

> "this is not a MUST because we want the "step detection" to work even in weird corner cases and be
> extremely robust. git is a bit too slow for that."

So the commit is the base, and a faster or sturdier reading may lay over it when it cannot be wrong.
There is one today: a write of the human's that Uraeda is still committing counts at once. An
approval moves the step when it is pressed, and a refused commit moves it back. A file edited by
hand moves the step only once it is committed.

## Never early

> "wait for agent runs to _fully_ finish (including sub-agents or background comments) before saying
> it's "waiting on you" … make sure the "PR ready" state means the PR was opened"

A status never says more than is true. "Ready" means the human can act now, on the latest work. A
pull request with commits still to push, or behind the default branch, is the agent's step, and
reads in progress.

## What each status tells the human

| It reads        | When                                                   | In the human's words                                                |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------- |
| In progress     | a session runs, or a run waits to continue by itself   | "It should be inside "in progress", because it's in progress."      |
| Needs you       | a gate waits for them, or a problem stops the workflow | "Needs you is more important than In Progress"                      |
| Needs attention | a run failed or was stopped, until they dismiss it     | "a very clear feedback in the UI that this session NEEDS attention" |

- **Needs you comes first**, before what is in progress, wherever the two are listed.
- **Labels are short**: "Rewrite status messages to be shorter to go with it: "Spec ready", "PR
  ready", ..."
- **A wait says when it ends**, "Waiting until 8:41": the time the run goes on.

Where each shows is the page's: `ura serve`'s home lists what waits on the human, across
repositories.

## Checks: problems and notes

> "Generally we don’t really care about small problems to proposal + our flow should not create
> errors."

`ura check` finds what is wrong in the workflow's files. Most of it is drift: a missing heading, a
link into a worktree, a file an agent is still writing. The human asked that those stop reading as
the feature's fault: "right now features in dev very often show up as having “problems” when they
don’t".

- **A new check is a note**, unless the workflow cannot go on without a fix. That is a habit for
  whoever writes the check, and the decision's last rule is the limit behind it.
- **Notes stay on their item's page.** Home and the sidebar list problems alone.
- **An error Uraeda's own flow produced is a bug of the flow.** Fix what wrote the file, not the
  file, and never teach the human to ignore the error.
- **In a terminal and an editor, `ura check` still reports every result as it is.** A note is the
  app's reading of an error, so agents and editors keep seeing format slips.
