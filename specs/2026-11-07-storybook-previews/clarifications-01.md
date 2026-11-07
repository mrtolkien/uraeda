---
status: answered
---

# Clarifications, round 01: Faster Storybook previews

> [!NOTE]
>
> Answered on 2026-11-07.
>
> - Verdict: worth building as proposed, since most of the wait comes from restarts and stops the
>   server controls, and changing them is cheap.
> - The overall approach: keep one live Storybook per branch and make it start less often, or move
>   to static builds, which changes the preview decision.
> - Which commits restart a Storybook, and how long it stays up, work together. They decide how
>   often you meet a cold start, against the memory kept busy.
> - To check: a story's frame shows only once its code has compiled, with "Starting Storybook" until
>   then.
> - Unverified: compiling the stories ahead inside Storybook gave no gain in one run on a loaded
>   machine. The plan checks it first.

## Context

### Goal

Story previews in rounds, specs, and sessions should show quickly, not after 10 seconds or more.
They should avoid the trouble an earlier attempt at starting Storybook ahead caused.

### Today

Each branch with stories gets its own Storybook process, started when a page reads one of its
stories ([`runner.ts`](/packages/server/src/preview/runner.ts)). Measured in this worktree, on a
busy machine:

| Phase                                               | Time         |
| --------------------------------------------------- | ------------ |
| Process start, until Storybook lists its stories    | 6 to 16 s    |
| First page-sized story, compiling about 600 modules | 22 to 41 s   |
| Another story of the same Storybook                 | 0.4 to 3.5 s |

The server calls a Storybook ready as soon as it lists its stories. The frame then sits blank while
the story compiles. Two rules make this cold start frequent:

- **Every commit restarts it.** The web UI's own commits count, such as submitting your answers.
- **It stops after 30 minutes without a view.** An agent's round starts it, but you read the round
  hours later.

The earlier trouble was twelve frames loading at once during a start, which froze the site, and
about 1.5 GB of memory per running Storybook
([warm-up record](/specs/done/2026-10-16-storybook-warmup.md)). Frames now load only once on screen.

### Scope

In scope: when a Storybook starts, restarts, and stops, compiling stories before showing them, and
what the frame shows meanwhile. Out of scope: the 22 s build of the native binding in a new
worktree, which only Uraeda's own Storybook needs.

### Sources

- The preview runner, the story embed, Uraeda's Storybook config, and timings of this worktree's
  Storybook.
- Storybook's docs and source, Vite's performance guide, Chromatic, Ladle, and Storybook's issues.
- The full investigation is in [discovery](discovery-01.md).

## Check these

- **The frame shows once the story compiled.** The server calls a Storybook ready only once it has
  compiled the stories its feature's files link. Until then the embed says "Starting Storybook for
  this branch…", instead of a blank frame. See [discovery](discovery-01.md#when-the-frame-shows).
- **The compile ahead is checked first.** Compiling ahead inside Storybook, through Vite's warm-up,
  showed no gain in one run on a loaded machine. The plan's first task measures it on a quiet
  machine. If it fails, the server compiles by fetching the story's page and its modules itself. See
  [discovery](discovery-01.md#worth-it-and-feasibility).

## Q1: How should story previews become fast?

Storybook, Chromatic, and other tools that embed stories all serve a static build, made once per
commit. A static build shows a story at once, but runs no server: Uraeda's stories read its real
server over sample data, which [the preview decision](/specs/decisions/preview.md) requires. Ladle,
another story runner, claims much faster starts, but nothing shows it with StyleX and the React
Compiler, which make Uraeda's compile slow. More in [discovery](discovery-01.md#overall-approach).

Why it matters: B and C change the preview decision, which every project's previews follow. D adds a
browser running inside Uraeda's server.

D can come on top of A.

- **A (recommended). Keep one live Storybook per branch. Make it restart less, stay up while you
  have something to review, and compile its stories before showing them.**
  - [pro] a story at a commit already started shows in about 1 second, live, with an agent's edits
    arriving as it saves.
  - [con] a true cold start, after a code commit or a server restart, still takes 10 seconds or
    more.
  - Why recommended: it removes most cold starts for little code, and keeps the decision.
- **B. Build a static Storybook once per commit, and serve its stories as files.**
  - [pro] every story shows at once once built, with no process kept per branch.
  - [con] a build per commit, likely a minute or more, no live edits, and a separate sample server.
- **C. Replace Storybook with a faster story runner, such as Ladle.**
  - [pro] possibly faster starts.
  - [con] every story and the skill's helper rewritten, for a speed nobody measured with our tools.
- **D. Show a picture of the story's last render while its Storybook starts.**
  - [pro] something to look at at once, as Chromatic shows a snapshot first.
  - [con] a headless browser in the server to take pictures, and a picture that can be stale.

**Answer:** A

## Q2: Which commits should restart a running Storybook?

Example: an agent's round with three variants is committed, and its Storybook started. You submit
your answers through the web UI, which commits `clarifications-01.md`.

A restart exists because Storybook reads some files only as it starts, such as its config or sample
data. A stale start once showed blank mockups, which is why every commit restarts it today
([restart record](/specs/done/2026-10-17-storybook-restart.md)). Code under `src/` reloads live
without a restart. How long a Storybook stays up is Q3: together they decide how often you meet a
cold start. More in [discovery](discovery-01.md#which-commits-restart).

Why it matters: each restart costs a cold start, 10 seconds or more, on the next view.

- **A (recommended). Restart only on a commit that changes a file outside `specs/`.**
  - Example: your answers change only `specs/`, so the Storybook keeps running.
  - [pro] the workflow's own commits never restart it, in any project, with no setting.
  - [con] an agent's code commit still restarts it, though live reload would often do.
- **B. Restart only on a commit that changes a file the preview decision lists as read at start, in
  a new field of that decision.**
  - Example: your answers keep it running, and so does an agent's commit under `src/`.
  - [pro] the fewest restarts.
  - [con] a new field to keep right in every project: a missed file shows stale stories until "Try
    again".
- **C. Never restart on a commit: only "Try again" restarts.**
  - Example: everything keeps it running.
  - [pro] no restart ever costs you a wait.
  - [con] the blank mockups the restart fixed come back after a config or sample-data change.

**Answer:** A

## Q3: How long should a Storybook keep running without a view?

Example: an agent commits a round with mockups at 10:00, and its Storybook starts. You open the
round at 15:00.

Today it stops after 30 minutes without a view, so you meet a cold start. Each running Storybook
holds about 1.5 GB of memory. With which commits restart it (Q2), this decides how often you wait.
More in [discovery](discovery-01.md#how-long-a-storybook-stays).

Why it matters: it trades memory kept busy for previews ready when you arrive.

- **A (recommended). Keep a branch's Storybook running while one of its files waits for you and
  links a story. Start it with Uraeda's server. Stop any other after 30 minutes.**
  - Example: at 15:00 the round's stories show at once.
  - [pro] ready exactly when there is something to review.
  - [con] 1.5 GB per feature waiting with mockups, for as long as it waits.
- **B. Stop it after 4 hours without a view, in place of 30 minutes.**
  - Example: at 15:00 it still runs, but not the next morning.
  - [pro] a single number to change.
  - [con] keeps idle Storybooks that nothing links, and misses reviews done the next day.
- **C. Keep 30 minutes.**
  - Example: at 15:00 you wait for a cold start.
  - [pro] the least memory.
  - [con] the wait the proposal complains about stays for most reviews.

**Answer:** A

## Settled without the human

### Behaviour

- **Frames still load once on screen**, as the earlier warm-up change set, so many frames never load
  at once during a start. See [discovery](discovery-01.md#past-trouble-with-pre-starting).
- **"Try again" stays**, restarting at once whatever the restart rule. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

### Under the hood

- **Uraeda's sample data builds faster.** Its Storybook builds a sample repository with dozens of
  git commands at each start, about 4 to 8 seconds. It gets cheaper, with no change to the stories.
  See [discovery](discovery-01.md#important-reads).
- **The runner splits before it grows.** It is at 447 of the project's 500 lines. See
  [discovery](discovery-01.md#likely-changes).

**Notes:**
