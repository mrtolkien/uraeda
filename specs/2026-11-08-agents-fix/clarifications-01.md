---
status: awaiting-human
---

# Clarifications, round 01: Agents catch up open pull requests with main

> [!IMPORTANT]
>
> 6 questions, about 20 minutes.
>
> - Verdict: worth building, with changes: a merge shows without pulling, since the server already
>   fetches every 5 minutes, and "outside `specs/`" would miss new decisions.
> - Which pull requests catch up sets the cost: only conflicting ones, or every one behind main.
> - Where the rule lives decides whether a pull request behind main still reads "ready for review".
> - A stopped catch-up needs a place to ask you: the pull request, a round, or the session.
> - Rebasing keeps the skill's force-push with lease, which the git decision's "no force-push" rule
>   reads against.
> - Two decisions change: run lifecycle gains a new kind of automatic run, and feature status a
>   reason a pull request is not ready.
> - Four points are settled without you: check them under "Check these", before the questions.

## Context

### Goal

The [proposal](proposal.md) asks that merging one pull request no longer means restarting the agents
of the others. When main moves, each other finished feature waiting at its pull request gets an
agent turn to catch up with main. The agent stops only on a hard conflict, behind a setting next to
the run settings.

### Today

- The skill already has a catch-up: rebase on `origin/main`, resolve conflicts by its rules, run the
  complete validation, push with `--force-with-lease`. It runs at the final review, and again before
  a pull request is marked ready. See
  [the catch-up](/skills/uraeda/references/implementation.md#catch-up-with-the-default-branch).
- Nothing runs it after a pull request is ready. Pull request #107 was caught up by hand at 22:12 on
  7 November, 9 minutes after #108 merged.
- The server fetches `origin` every 5 minutes ([`git-fetch.ts`](/packages/server/src/git-fetch.ts)),
  and reads open pull requests through `gh` every minute
  ([`pulls.ts`](/packages/server/src/pulls.ts)).
- It continues stopped runs by itself after a restart or a usage limit, capped at a number in a row.
  Each kind has a switch in Settings › Runs
  ([`continuer.ts`](/packages/server/src/runner/continuer.ts)).
- Nothing knows whether a branch is behind main or conflicts with it.

| Tool                   | Updates a pull request when | Updates by    | When it cannot              |
| ---------------------- | --------------------------- | ------------- | --------------------------- |
| Renovate, default      | it conflicts                | recreating it | —                           |
| Dependabot             | it conflicts                | rebase        | stops after a human's push  |
| Mergify `update`       | behind, without conflict    | merge         | skips it                    |
| Kodiak `update.always` | behind                      | merge         | comments, removes its label |
| Copilot Agent Merge    | it conflicts, opted in      | undocumented  | undocumented                |
| CodeRabbit, on request | asked                       | merge commit  | commits nothing, comments   |

### Scope

Open pull requests of finished features and changes, ready for review. Not covered: drafts and pull
requests with changes requested, whose own steps already run an agent. Nor are branches still being
built, which catch up at their final review. Per-feature settings come with
[Run options](/specs/2026-11-08-run-options/proposal.md), started in parallel.

### Sources

- The server's fetcher, pull requests, watcher, continuer, and messages, and the core's step table,
  read on `main`.
- GitHub, GitLab, Renovate, Dependabot, Mergify, Kodiak, Graphite, Copilot, CodeRabbit, and Claude
  Code documentation; benchmarks of automated conflict resolution.
- An experiment: the core's git library, gix, finds a conflict between two branches in memory in 3
  to 9 ms, writing nothing.
- The full investigation is in [discovery](discovery-01.md).

## Check these

- **Both features and changes** catch up, like the push step, which covers both. See
  [likely changes](discovery-01.md#likely-changes).
- **The catch-up runs in the feature's latest session**, on its agent and model, as automatic
  continues do. Run options may later give it a session of its own. See
  [the continuer](discovery-01.md#important-reads).
- **There is no opt-out per pull request** yet: stopping the run is one, and Run options plans
  per-feature overrides of run settings. See [needs no choice](discovery-01.md#needs-no-choice).
- **Once per branch and per tip of main**: a catch-up that stopped is not retried until main moves
  again, or you continue it. Nothing can loop. See
  [needs no choice](discovery-01.md#needs-no-choice).

## Q1: Which open pull requests should catch up when main moves?

Example: three pull requests wait for your review. You merge "Codex runtime", which changed
`runner/claude.ts`. "Run options" also edits `runner/claude.ts`, and conflicts; "Agents fix" touches
other files, and is only behind.

The proposal's title says "fix merge conflicts", and its note suggests "any change on main to files
outside `specs/`". Decisions live in `specs/decisions/`, and the catch-up reads new ones to stop on
a rule the branch breaks: the `specs/` filter would skip them. Branches never write `PRIORITIES.md`,
`INBOX.md`, proposals, or notes, so those never conflict. GitHub's rebase merge works on a branch
only behind, but its tests ran against the old main. Benchmarks put automated resolution at 55 to
60% right before any build or test. Kodiak warns that updating every pull request behind costs up to
N(N-1)/2 updates for N open ones. More in [discovery](discovery-01.md#which-pull-requests-catch-up).

Why it matters: it sets how many agent runs and validations each merge costs. It also decides
whether a pull request you merge was tested against the main it lands on.

- **A (recommended). Catch up only the pull requests whose branch conflicts with main, checked in
  memory each time main moves.**
  - Example: only "Run options" gets a turn; "Agents fix" stays as it is.
  - [pro] the fewest runs and force-pushes, as Renovate and Dependabot do by default.
  - [con] a branch only behind merges untested against the new main, and a new decision on main is
    read only when the branch conflicts.
  - Why recommended: it is what the proposal's title asks, and main's own CI after the merge catches
    what the merge breaks.
- **B. Catch up every pull request behind main whose new commits change code, decisions, or records,
  the files a branch can conflict with.**
  - Example: both "Run options" and "Agents fix" get a turn.
  - [pro] every pull request is validated against the current main, and checked against its new
    decisions.
  - [con] a run per open pull request on every merge.
- **C. Catch up every pull request behind main whose new commits change a file outside `specs/`, as
  the proposal's note suggests.**
  - Example: both get a turn, but none would after a merge that only changed a decision.
  - [pro] the proposal as written.
  - [con] the runs of B, yet a new decision alone never triggers one.

**Answer:**

## Q2: What should make Uraeda look at the open pull requests?

Example: you merge "Codex runtime" on GitHub at 10:00, and do not pull until 18:00.

The server already fetches `origin` every 5 minutes. The pull requests target `origin/main`, so the
catch-up rebases on it whatever your local main holds. A merge into your local main changes nothing
for them until you push it. More in
[discovery](discovery-01.md#pulling-is-not-needed-to-see-a-merge).

Why it matters: it decides whether the pull requests are fixed while you are away, or when you come
back.

- **A (recommended). The remote main moving, however Uraeda learns it: your pull, your push, or its
  own fetch every 5 minutes.**
  - Example: the catch-ups start by 10:05.
  - [pro] the pull requests are ready when you come back, and a local merge counts once pushed.
  - [con] a catch-up may force-push a pull request you are reading on GitHub.
  - Why recommended: it follows what the pull requests merge into, without waiting on you.
- **B. Your local main moving: a pull or a local merge, as proposed.**
  - Example: the catch-ups start at 18:00, when you pull.
  - [pro] you choose the moment, after merging several pull requests in a row.
  - [con] nothing happens until you pull, and a local merge followed by a push triggers before the
    push, when there is nothing to catch up yet.

**Answer:**

## Q3: Should a pull request that needs a catch-up still read "ready for review"?

Example: "Run options" conflicts with main after your merge, and the switch of Q6 is off.

Today a pull request reads ready only once it holds the branch's latest commit: otherwise its step
is `push`, agent work, as the [feature status](/specs/decisions/feature-status.md) decision asks. A
catch-up can be a step the same way, in the skill's table and `ura next`, so an agent without the
server catches up too. Or the server can send the message alone, the step staying "ready". More in
[discovery](discovery-01.md#where-the-rule-lives).

Why it matters: it decides what every view and `ura next` say about such a pull request, and whether
the catch-up works without the web UI.

- **A (recommended). Yes, a new step: a pull request needing a catch-up reads as agent work, "Catch
  up with main", everywhere. The switch only decides whether Uraeda starts it by itself.**
  - Example: "Run options" reads as agent work; with the switch off, "Continue" or "Continue all"
    runs it.
  - [pro] the status never calls a conflicting pull request ready, and any agent finds the step.
  - [con] the skill's step table and its references change, and the feature status decision gains a
    rule.
  - Why recommended: principle V of the constitution asks the workflow to work without the tools.
- **B. No, a server behaviour: the pull request keeps reading ready, and the server sends the
  catch-up message.**
  - Example: "Run options" reads ready for review; with the switch off, nothing shows the conflict
    but GitHub.
  - [pro] the skill stays as it is.
  - [con] an agent run without the server never catches up, and the status hides the conflict.

**Answer:**

## Q4: Where should a catch-up that cannot settle a conflict ask you?

Example: main removed a function "Run options" now calls, and keeping both needs a choice the spec
does not settle.

The proposal says to "stop on problematic conflicts and raise an issue". The skill's rule today, for
a conflict needing a choice, is a new round of questions. On a finished feature, that reverts its
record, brings its folder back, and turns the pull request back into a draft. Pull requests already
take your comments: requesting changes there runs an agent on them. CodeRabbit gives up whole: no
commit, and a comment naming the files and why. More in
[discovery](discovery-01.md#a-conflict-the-agent-cannot-settle).

Why it matters: it decides how heavy the rare stop is for you, and whether the question survives
outside the session.

- **A (recommended). The agent leaves the branch as it was, and comments on the pull request with
  the conflicting files and the choice. The feature asks for you. You answer by requesting changes
  on the pull request.**
  - Example: a comment says "`runner/claude.ts`: main removed `claudeArgs`; keep its model flag
    here, or drop it?", and you reply in a review.
  - [pro] light, kept on GitHub, and answered through the comments pass that already exists.
  - [con] the skill's "a choice is always a round" rule gains an exception.
  - Why recommended: the pull request is already where you review a finished feature.
- **B. A new round of questions, as the skill asks today.**
  - Example: the record is reverted, the pull request becomes a draft, and a round with one question
    waits for you.
  - [pro] one rule for every choice, recorded in the repository.
  - [con] heavy for one conflict: a revert, a round, then finishing again.
- **C. Only a message in the feature's session, and the feature asks for you.**
  - Example: the session explains the choice, and you answer there.
  - [pro] the quickest to answer.
  - [con] the question lives only in the session, a cache outside the repository.

**Answer:**

## Q5: Should the catch-up rebase the branch, or merge main into it?

Example: "Agents fix" holds 40 commits, the last one its record, and you left two comments on its
pull request.

The skill's catch-up rebases and pushes with `--force-with-lease`, which refuses to overwrite a push
made meanwhile. The finish step needs the record to stay the last commit, and advises a rebase merge
on GitHub. The [git decision](/specs/decisions/git.md) says tools never force-push, to never lose
work: the lease is what keeps that. Most compared tools merge main in for a pull request under
review, so comments and "changes since last review" keep their place. More in
[discovery](discovery-01.md#rebase-or-merge).

Why it matters: it decides the history main gets, and what happens to a review in progress.

- **A (recommended). Rebase on main and push with `--force-with-lease`, as the skill does today,
  read as allowed by the git decision since the lease never loses work.**
  - Example: the 40 commits are replayed on main, the record still last; your two comments may show
    as outdated.
  - [pro] one catch-up in the skill, and a linear history.
  - [con] a review in progress loses "changes since last review".
  - Why recommended: you usually review after the catch-ups, and the finish step relies on the
    record being last.
- **B. Merge main into the branch, with a plain push.**
  - Example: one merge commit lands after the record; your comments keep their place.
  - [pro] no force-push, and a review in progress keeps its place.
  - [con] the record is no longer the last commit, and a rebase merge of a branch holding merge
    commits is not verified on GitHub.

**Answer:**

## Q6: Where should the switch live, and should it be on by default?

Example: you open Settings › Runs, which holds "Continue after a restart" and "Continue after a
limit", both on by default.

The [run lifecycle](/specs/decisions/run-lifecycle.md) decision asks every kind of automatic run for
a switch, a line in its session saying why, and a cap. The catch-up would join it as a new kind,
starting from your gate rather than continuing a stopped run. Run options, in parallel, plans
defaults with per-feature overrides for every run setting. More in
[discovery](discovery-01.md#the-switch).

Why it matters: it decides whether the catch-ups run the day this ships, and what Run options must
take over.

- **A (recommended). One switch, "Catch up open pull requests with main", in Settings › Runs and
  `[runs]`, on by default; Run options adds per-feature overrides later.**
  - Example: after this ships, your next merge starts the catch-ups.
  - [pro] works at once, next to the other automatic runs.
  - [con] agent usage you did not see coming, the first time.
  - Why recommended: the proposal's goal is not having to think about it, like the other automatic
    continues.
- **B. The same switch, off by default.**
  - Example: nothing changes until you turn it on.
  - [pro] no surprise usage.
  - [con] one more setting to find before the feature does anything.
- **C. No switch now: build it within Run options.**
  - Example: this feature waits for Run options' spec.
  - [pro] one design for every run setting.
  - [con] this feature waits on another one that has not started its discovery.

**Answer:**

## Settled without the human

### Behaviour

- **A branch with a session at work** is skipped, and checked again once its turn ends. See
  [existing actions](discovery-01.md#the-proposals-path-and-existing-actions).
- **The session says why it ran**: "Caught up with main after it moved to <commit subject>", as the
  run lifecycle decision asks. See [Rules and their owners](discovery-01.md#rules-and-their-owners).
- **A catch-up that ends at the pull request again does not notify you**: the pull request was
  already waiting for your review. See [important reads](discovery-01.md#important-reads).
- **Several catch-ups run at once**, one per worktree, as features already do. See
  [important reads](discovery-01.md#important-reads).
- **The catch-up follows the skill's rules**: new decisions read, generated files and lock files
  regenerated, links repaired, the complete validation run before the push. See
  [needs no choice](discovery-01.md#needs-no-choice).

### Under the hood

- **The conflict check** runs in the core with gix's in-memory merge, enabling gix's `merge`
  feature, writing nothing, as the git decision asks of reads. See [gix](discovery-01.md#gix).
- **The trigger** is a server module of its own, beside the continuer, which is near its 500-line
  limit. See [important reads](discovery-01.md#important-reads).
- **No git hook** is installed in your repository: the watcher and the fetcher already see the refs
  move. See [git](discovery-01.md#git).

**Notes:**
