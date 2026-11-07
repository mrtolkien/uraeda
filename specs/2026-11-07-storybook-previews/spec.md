---
status: approved
revision: 1
clarifications: 1
risk-tier: medium
plan-review: false
---

# Spec: Faster Storybook previews

> [!NOTE]
>
> Approved on 2026-11-07.
>
> - You approve story previews that are ready when you arrive. A branch's Storybook stays up while
>   one of its files waits for you with a story link, and survives commits that change only
>   `specs/`. It compiles a story before its frame shows.
> - No decision changes: the preview decision's live Storybook per branch stays.
> - Cost: about 1.5 GB of memory per branch waiting for your review with stories, for as long as it
>   waits, and every such Storybook starts with Uraeda's server.
> - Unverified: compiling a story's code ahead, by fetching it as a browser would. The plan's first
>   task measures it. If it gains nothing, stories are not compiled ahead, and frames show as soon
>   as Storybook lists its stories, as today.
> - Risk tier `medium`: the server's process rules change, with no stored data. The plan does not
>   wait for your review.

Story previews in rounds, specs, and sessions take 10 seconds or more to appear. Most of the wait is
a cold start: Storybook restarts at every commit, the web UI's own included, and stops 30 minutes
after its last view, while you read a round hours later. This feature keeps the live Storybook per
branch, restarts it less, keeps it up while you have something to review, and compiles a story
before showing it. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Decisions

Relied on:

| Decision                                     | What it means for this spec                                                   |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| [Preview](../decisions/preview.md)           | one live Storybook per checkout, over the real server, stays the only preview |
| [Performance](../decisions/performance.md)   | the target: a story shows within 1 second when its Storybook runs             |
| [Stack](../decisions/stack.md)               | the proxy and its frame rules stay as they are                                |
| [Git](../decisions/git.md)                   | worktrees stay the workflow's: no checkout is made to run a preview           |
| [Testing](../decisions/testing.md)           | the runner's rules get unit tests, stories stay previews                      |
| [Code quality](../decisions/code-quality.md) | the runner, at 447 of 500 lines, splits before it grows                       |

## User stories

### US1: A story shows at once when I open a file to review (P1)

An agent ends a round with mockups. Hours later, I open the round and its stories show at once,
since the branch's Storybook stayed up and compiled them while the round waited for me.

Key scenarios:

1. **Given** an agent's turn ends at 10:00 with `clarifications-01.md` waiting for the human and
   linking 3 stories, **When** no page views them until 15:00, **Then** the branch's Storybook still
   runs at 15:00, its 3 stories already compiled.
2. **Given** that round at 15:00, **When** I open it, **Then** each story's frame shows its story
   within 1 second of reaching the screen.
3. **Given** I submit my answers at 15:20, so no file waits for me, **When** no page views the
   branch's stories after 15:20, **Then** its Storybook stops at 15:50.

More scenarios:

1. **Given** two features each wait for me with a story link, **When** Uraeda's server starts,
   **Then** both Storybooks start, one after the other, and compile their linked stories.
2. **Given** a feature waits for me with a file that links no story, **When** 30 minutes pass
   without a view, **Then** its Storybook stops, as today.

### US2: My answers do not restart the Storybook (P1)

A commit that changes only files under `specs/`, such as my submitted answers, the agent's spec, or
the inbox, keeps the branch's Storybook running with what it compiled.

Key scenarios:

1. **Given** a branch's Storybook running at commit `a1`, **When** I submit answers, committing only
   `specs/2026-11-07-x/clarifications-01.md`, **Then** the next view keeps the same process, and its
   stories show within 1 second.
2. **Given** that Storybook, **When** an agent commits `packages/web/src/Sidebar.tsx`, **Then** the
   next view restarts it, as every commit does today.

More scenarios:

1. **Given** a Storybook started at `a1`, **When** two commits follow, one under `specs/` and one
   under `packages/web/.storybook/`, **Then** the next view restarts it once.

### US3: A frame shows its story, never a blank page (P2)

Until a story's code has compiled, its embed says it is starting, and its frame shows once the story
can draw at once.

[Starting](/packages/web/src/StoryEmbed.stories.tsx#Starting)

Key scenarios:

1. **Given** a Storybook that has just listed its stories, **When** a page shows a story whose code
   is not compiled yet, **Then** the embed reads "Starting Storybook for this branch…" until it is,
   then shows the frame.
2. **Given** a story whose compile fails or passes 60 seconds, **When** the compile ends or times
   out, **Then** the frame shows anyway, and Storybook shows its own loader or error.

## Replaced behaviour

- **Every commit restarts the checkout's Storybook at its next view, a commit under `specs/`
  included.** Guarded by `runner.test.ts`'s "a view at a new commit starts a failed Storybook again;
  one at an unknown commit does not", whose commits become code versions.
- **A story is ready as soon as its Storybook lists its stories.** Guarded by `preview.test.ts`'s "a
  story's first read starts its Storybook, and turns ready live (US1.1)", which then waits for the
  story's compile.

## Architecture

The runner keeps one `storybook dev` per checkout, as the
[preview decision](../decisions/preview.md) asks. Three rules change, each in its own unit, so the
runner can split along them: when a Storybook restarts, when it stops, and when a story counts as
ready. Static builds and another story runner were weighed and dropped: see
[discovery](discovery-01.md#overall-approach).

- **The code version** is a checkout's commit with `specs/` left out: the tree of the commit without
  its `specs/` entry, read by the core. The runner compares code versions where it compared commits,
  so it owns the rule "only a commit outside `specs/` restarts".
- **The review watch** tells whether a folder has a file waiting for the human that links a story,
  from the core's step and that file's links. It owns the rule "kept up while it waits for you".
- **The idle sweep** stops a Storybook after 30 minutes without a view, unless the review watch
  keeps it. It is the runner's only stop for idleness.
- **The start at boot** asks the review watch for every waiting folder of each listed repository as
  the server starts, and starts their Storybooks one at a time.
- **The story warmer** compiles a story's code in a ready Storybook by requesting it as a browser
  would, once per story per Storybook, shared by concurrent reads. It owns "a story is ready once
  compiled, or after 60 seconds".
- **The ahead warm** extends today's start at a turn's end: it also warms the stories its waiting
  file links.

Tradeoffs:

- Memory: each waiting branch with stories keeps about 1.5 GB until answered.
- A commit under `src/` still restarts the Storybook, though live reload would often do.
- At boot, several Storybooks starting one after another load the machine for a minute or more.

## Edge cases

| Importance | Situation                                                   | What happens                                                         |
| ---------- | ----------------------------------------------------------- | -------------------------------------------------------------------- |
| High       | A commit changes `.storybook/` and `specs/` together        | the next view restarts it                                            |
| High       | A code version cannot be read                               | it counts as unknown, which restarts as an unknown commit does today |
| Normal     | The waiting file links a story of another branch, or `main` | that checkout's Storybook is kept and warmed too                     |
| Normal     | A feature waits for the human, and its worktree is removed  | its Storybook stops at the next sweep, as today                      |
| Normal     | A sign-out replaces the frame secret                        | every Storybook stops; waiting ones start again at their next view   |
| Normal     | "Try again" on a kept Storybook                             | it restarts at once, then warms the stories read again               |
| Niche      | A story's compile fails                                     | the frame shows Storybook's own error                                |
| Niche      | The branch has no `node_modules` at boot                    | nothing starts, as at a turn's end today                             |

## Success criteria

- **SC-001** (warm view): a story whose Storybook runs at its code version shows within 1 second of
  its frame reaching the screen, on a quiet machine.
- **SC-002** (answers): submitting answers starts no Storybook process.
- **SC-003** (waiting): a Storybook whose branch waits for the human with a story link is not
  stopped after 30 minutes without a view.
- **SC-004** (no blank): no frame loads before its story's compile ended or timed out.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there. Settled
while writing this spec:

- **The warmer fetches over HTTP**, so it works with any project's Vite Storybook without a change
  to the skill's helper. The plan's first task measures it against Vite's own warm-up.
- **The text stays "Starting Storybook for this branch…"** while a story compiles: to you both are
  the same wait.
- **Changes count as folders**: a change waiting for the human with a story link is kept up too.
- **Uncommitted edits** under `.storybook/` still need "Try again", as today.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**Medium**: the server's process lifecycle changes, and more Storybooks stay up; no stored data or
format changes.
