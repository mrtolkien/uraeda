---
verdict: changes-requested
commit: d493ba3
---

# Review: Spec, Scheduled jobs

## C1: Lines 89–91, under "US2: Missed and skipped runs (P1)"

> A time missed while the server was off, or the machine asleep, is made up once when it is back. A
> time is skipped while the job's last run still works in that repository, or while a change it
> started there is still open. A skipped time is not made up.

Actually let's do the opposite. If a run was missed, that's life. I don't leave uraeda on all the
time and I don't want it to start ~5 jobs if I ever re-open an old repo.

## C2: Decision agents, lines 27–28, under "Rules"

> - An agent MUST NOT turn a session into a change, or a change into a feature, unless the human
>   accepts it: each offer, or in advance the changes of a job they scheduled.

The wording sounds weird to me.

## C3: Lines 113–116, under "US3: A job starts changes by itself (P1)"

> A job with `starts_changes = true` has your yes in advance. When its run ends on a change offer,
> Uraeda starts that change as the offer's card would: its proposal, its branch, its worktree. The
> session moves into it and goes on to a pull request, which waits for you. Without the key, the
> offer's card waits in the session, as in any session.

Should be the default honestly, the flag should be the other way around. Most jobs have the goal to
create a change to be reviewed by the human.

## C4: Line 147, under "US4: The Jobs place (P2)"

> [The jobs](/packages/web/src/jobs/JobsMockups.stories.tsx#JobsList)

Story JobsMockups.stories.tsx#JobsList, desktop, listitem with “DependenciesStarts changes
Dependencies…”: Hard to read, not enough contrast, looks like one big blob atm.

Make nice cards. Nice information hierarchy. Icons.
