# Agent runs

How a run of an agent should start, go on, and stop, for the agent about to change the runner, a
runtime, or a view of sessions. The boundaries are in three decisions:
[Agents](../decisions/agents.md), [Run options](../decisions/run-options.md), and
[Run lifecycle](../decisions/run-lifecycle.md). This guide says what they aim at, and how the runs
behave today.

**Open since 2026-11-13**: the human asked whether Uraeda should run agents at all, or sit on
another orchestrator with its skill, its CLI, and a small view. "What I'm trying to do is to retain
most of the current workflow's convenience, without the maintenance burden of the current uraeda
codebase." Until they decide, build nothing large here without asking. What they said must survive
either way is in [What the human keeps](#what-the-human-keeps).

## What it is for

The human starts work and leaves. "It's annoying when I start 4 features before going to sleep to
then have to restart 3 after merging the first." A run that stops for something outside the work, a
restart, a limit, a branch left behind, should go on without them, up to the next point where only
they can decide.

It is a best effort, and the human accepts that it fails sometimes. On continuing after a usage
limit: "It's life if it's flaky. It's a best effort feature." On a job whose time passed while the
server was off: "If a run was missed, that's life. I don't leave uraeda on all the time and I don't
want it to start ~5 jobs if I ever re-open an old repo." So never add machinery to make an automatic
run certain: when it cannot go on, it asks for the human, plainly.

## What Uraeda does by itself

| When                                        | What happens                                                                          | By default |
| ------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| A step ends before a human gate             | Uraeda starts the next step's run, each step a run of its own                         | On         |
| The server restarts during a run            | The run continues from its agent's session, when it was cut less than 6 hours before  | On         |
| A usage limit refuses a run                 | It goes on at once on another account with room, else when the limit resets           | On         |
| An open pull request is behind main         | Its agent rebases, validates, and pushes, once per tip of the default branch          | Off        |
| A scheduled job's time arrives              | Its run starts, and the change it offers starts too, unless the job is report only    | Per job    |
| A reply ended, and its background work runs | After 10 minutes without output the agent is asked about it, then fails 10 minutes on | On         |

Each line of the table has its record, which holds its texts, keys, and numbers:
[Run options](../done/2026-11-08-run-options.md) for the chain,
[Worker lifecycle](../done/2026-11-03-worker-lifecycle.md) for restarts and limits,
[Agents catch up](../done/2026-11-08-agents-fix.md), and
[Scheduled jobs](../done/2026-11-10-scheduled-jobs.md). Three things changed after those records
were written, and no record says them:

- **A run a limit refused moves to another account.** The human first chose to wait: "Let's just
  wait on limits actually hit." A day later: "Now that we support multi-accounts, maybe we could
  actually continue sessions that hit a usage limit with another account … I know I chose against it
  but I want to review that decision". The session moves to the account with the most room among
  those that hold its conversation, with a line naming it. A weekly limit moves too, and with no
  room elsewhere it stops the run. The accounts are the human's own: "They are all my accounts."
- **Uraeda no longer asks a run that ended early to go on.** It sent "You stopped before the next
  human gate. Continue to it.", and the human had it removed: "It misfires 99% of the time." A run
  that ends before its gate asks for the human. This is not the chain: the chain starts the next
  step after a step that finished.
- **A reply stuck on a background command is checked.** The human found a session stuck and asked:
  "Should we add a 5 minutes check-in or something?" The numbers, 10 minutes and 10 more, are the
  code's, and free to tune.

## Habits

These are habits, not rules: follow them unless a spec says why not.

- **An automatic run says why in its session**, in one line: "Continued after the server restarted."
  The human sees what Uraeda did in their place.
- **A run that waits to continue is in progress**, with the time it goes on: "It should be inside
  "in progress", because it's in progress."
- **A turn that ended with nothing running needs the human**, and looks like it: "a finished agent
  turn with no sub-agent or command running SHOULD ask for human attention, right?"
- **A sub-agent is shown as what it is, a session**: listed on its feature's page as a sub-session,
  with a page of its own and no composer.
- **A job is made to produce a change**: "Most jobs have the goal to create a change to be reviewed
  by the human." Nothing merges without them.
- **A reviewer is an agent or a command**: "We need to be able to use the actual "review" features
  of the harnesses if they exist though."
- **Agents wait for their background work by its notice**, never in a loop: the skill says so.

## Working on a runtime

Tests reach agents through a fake, and a real agent is run by hand: "Actual tests should use mocks,
but in the development process you are allowed to test the server code against the real, local
claude code." The same holds for Codex: "you're allowed to run actual codex during the development
to validate behaviour." Keep what you ran as a script in the repository, to run again when an
agent's update breaks its runtime.

Expect that breakage. "Claude Code integration will always be flaky". A runtime reads its agent's
events itself, so a new version of the agent can break it, and that is accepted.

## What the human keeps

From their message of 2026-11-13, what any tool must keep, whoever runs the agents:

- "I want to keep the async part: an agent works solo on clarifications and specs I can review
  in-depth, with context"
- "I also want to be able to jump directly in the session, it comes up often"
- "I want to be able to select models per step for the workflow still"
- "I don't want to raw dog claude code, I want a good orchestrator"
