---
status: approved
revision: 1
clarifications: 1
risk-tier: high
plan-review: false
---

# Spec: Performance pass

> [!NOTE]
>
> Approved on 2026-10-30.
>
> - You approve pages and keys that answer within 100 ms from caches on the server and in the
>   browser. Writes show their result at once, and commits land behind a toast, in order. Starting a
>   feature never makes you wait.
> - Changed decision, UI behaviour: a commit no longer blocks the others. Its result shows at once,
>   and a glass toast at the bottom right says it is still landing.
> - New decision, Performance: 100 ms as a SHOULD, the server's cache as a MUST, and a benchmark run
>   on demand.
> - Your note on the pending bar wins: no page shows a loading state, and only a development build
>   warns past 100 ms.
> - I read "we don't have to lie" as a result shown at once while the toast says it is still
>   landing. A hook's refusal undoes it, and says why where it happened.
> - Unverified: that refreshing a new worktree's index ends its slow reads, and that fate's fix
>   covers live refreshes. The plan's first task checks both.
> - Risk tier `high`: a cache in the core that misses a change shows stale data.

Uraeda's web UI feels sluggish: pages take 0.2 to 2.6 s, every commit stops the human for its hooks,
and starting a feature took up to 29 s on this repository. This feature makes the server answer from
what it already read, and the browser keep what it showed. Writes show their result at once, and
commits land behind a toast. See the [proposal](proposal.md), [discovery](discovery-01.md), and
[clarifications](clarifications-01.md).

## Decisions

- **Changed: [UI behaviour](../decisions/ui-behaviour.md)**. A write shows its result at once and
  takes the human where it leads. A git write shows its progress in a toast, and git writes land in
  order without blocking the human.
- **New: [Performance](../decisions/performance.md)**. Every page and action should answer within
  100 ms, from reads the server already made, checked by a benchmark run on demand.

Relied on:

| Decision                                     | What it means for this spec                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| [Stack](../decisions/stack.md)               | the read cache lives in the core; the browser never computes a folder or a step |
| [Git](../decisions/git.md)                   | commits still run the user's hooks, through the system `git`                    |
| [UI look](../decisions/ui-look.md)           | the toast is the leader menu's frosted glass, square                            |
| [Toolchain](../decisions/toolchain.md)       | no hand memoizing; React Compiler stays                                         |
| [Testing](../decisions/testing.md)           | at the `early` stage, tests cover the cache, the queue, and the start's states  |
| [Code quality](../decisions/code-quality.md) | timings are checked by a benchmark of these success criteria, never a unit test |
| [Preview](../decisions/preview.md)           | the mockups are stories of the real components                                  |

## User stories

### US1: Every page draws at once (P1)

The human moves through the app by click or by key, and every page draws within 100 ms, reloads
within a second. Nothing shows a loading state.

Key scenarios:

1. **Given** the server serves this repository, 69 features, **When** the human clicks the feature
   Performance pass in the sidebar, **Then** its page draws within 100 ms.
2. **Given** the priorities list, its selection on its first row, **When** the human presses `j`
   three times, then `Enter`, **Then** the fourth row's page draws within 100 ms.
3. **Given** a feature's page, **When** the human reloads it, **Then** it draws within 1 second, its
   sidebar's 69 cards with their changed lines' counts.

More scenarios:

1. **Given** Start made a new worktree a second ago, **When** the human opens any page, **Then** it
   still draws within 100 ms.
2. **Given** an agent commits on the branch of the feature shown, **When** its commit lands,
   **Then** the page shows it within 1 second, with no reload.

### US2: Writes show their result at once (P1)

Every write that is not a commit shows its result at the human's press: an answer picked, a comment
saved, a note moved, a text saved, a setting changed, a message sent.

Key scenarios:

1. **Given** question Q3 of a round, **When** the human picks option B, **Then** B shows picked
   within 100 ms, before the server answers.
2. **Given** the inbox, **When** the human moves the note "Vim in text edit mode" to Now with `p`,
   **Then** the priorities open with it in Now within 100 ms.
3. **Given** a session, **When** the human sends "Why does the login redirect twice?", **Then** the
   message shows in the transcript at once.

More scenarios:

1. **Given** another tab saved `proposal.md` since this one read it, **When** the human saves it
   here, **Then** the server refuses the stale write, the browser reads the file again and retries
   once.
2. **Given** the server refuses a moved note, **When** its refusal arrives, **Then** the note is
   back in its category, and the refusal shows on its row until dismissed.

### US3: Commits land behind a toast (P1)

A commit shows its result at once and takes the human where it leads. A glass toast at the bottom
right says what is still landing, and the next commits wait their turn behind it.

[Commit running](/packages/web/src/writes/CommitToast.stories.tsx#Running)

[Commits queued](/packages/web/src/writes/CommitToast.stories.tsx#Queued)

[Commit refused](/packages/web/src/writes/CommitToast.stories.tsx#Refused)

Key scenarios:

1. **Given** the spec of Performance pass, **When** the human approves it, **Then** it reads
   Approved, the session opens with its message in the composer, and the toast reads "Approving the
   spec of Performance pass…".
2. **Given** that approval still runs its hooks, **When** the human commits the answers of Decisions
   needs, **Then** the toast lists it under the approval, waiting, and nothing is disabled.
3. **Given** a hook refuses the approval, **When** its refusal arrives, **Then** the spec reads
   awaiting review again, the verdict's place shows the hook's output, and the toast keeps it with
   Open and Dismiss.

More scenarios:

1. **Given** two tabs on the same repository, **When** one commits, **Then** both show the same
   toast.
2. **Given** the approval was refused, **When** the human presses Open in the toast, **Then** the
   spec opens at its verdict, the hook's output there.

### US4: A feature starts without waiting (P1)

The human writes a proposal, presses Start, and lands at once on the feature's session, its steps
listed where the transcript will be. They can send the message at once, and go on working elsewhere:
the agent starts once the steps end.

[Start running](/packages/web/src/session/StartSteps.stories.tsx#Running)

[Message queued](/packages/web/src/session/StartSteps.stories.tsx#MessageQueued)

[Start refused](/packages/web/src/session/StartSteps.stories.tsx#Refused)

Key scenarios:

1. **Given** the New page, **When** the human types "Performance pass" and presses `Ctrl+Enter`,
   **Then** the editor opens on its proposal file within 100 ms, in one request.
2. **Given** the editor of that proposal, its slug `performance-pass`, **When** the human presses
   Start, **Then** the session of `2026-10-29-performance-pass` opens within 100 ms. Its composer
   holds the workflow's message, and its steps run: commit, branch and worktree, agent.
3. **Given** the steps still run, **When** the human presses Send, then opens the inbox, **Then**
   the message waits, and the agent starts with it once the worktree exists.

More scenarios:

1. **Given** a hook refuses the start's commit, **When** its refusal arrives, **Then** the commit's
   step shows the hook's output, nothing was made, and the queued message is back in the composer,
   unsent.
2. **Given** the editor, **When** the human presses `Ctrl+Enter` or `Enter` in the slug, **Then**
   the start runs exactly as Start's button does.

### US5: The target is kept (P2)

A benchmark measures the pages and actions of these stories on demand, and a development build warns
when one passes 100 ms.

Key scenarios:

1. **Given** the sandbox, **When** the benchmark runs, **Then** it reports each page's and action's
   time against 100 ms, and each reload's against 1 second, on a release build.
2. **Given** a development build, **When** a click takes 140 ms to draw, **Then** the console warns
   with the interaction's name and its time.

## Replaced behaviour

- **A git write blocks the other writing buttons, and a thin bar runs at the page's top while it
  runs.** Guarded by `packages/web/src/__tests__/writes-store.test.tsx`: "a write started during
  another one keeps the bar until it ends".
- **A git write shows its action on its item's card, until the server's status changes or 10 seconds
  pass.** Guarded by the same file: "a commit shows on its card while it runs, then 10 seconds at
  most", "the server's status for the item ends the action", "a failed write shows the server's
  status again at once", and "a write that fails after the server's status changed never shows its
  action again".
- **Start waits on the editor until the feature is made, then opens its session.** Guarded by
  `packages/web/src/__tests__/editor.test.tsx`: "Start saves the text typed, then starts the feature
  from it (US2 4)".

## Architecture

The server reads git once and keeps what it read, and the browser keeps what it showed. Waiting
moves off the human's path: writes show their result before they land, and commits run in a queue.
Every read rebuilding the whole workspace was the root cause
([where the 10 seconds go](discovery-01.md#where-the-10-seconds-go)), and fate already has the
browser's pieces ([fate](discovery-01.md#fate-1121)).

- **The read cache**, in the core, keeps each repository's workspace between calls. The watcher's
  changes drop what changed, and a write refreshes it before it answers. It owns freshness: no read
  answers from data older than the last change the watcher saw.
- **The new worktree's index** is refreshed right after `git worktree add`, so the next reads stop
  rehashing its files.
- **The write queue**, in the server, runs each repository's git writes one after another, in order.
  It publishes them as one live record, each running, waiting, or refused, with the hook's output
  streamed from the core. The core's write lock becomes one per repository.
- **The start** answers once it is planned: the folder, and the workflow's message. The queue then
  commits, makes the branch and its worktree, and sends the session's queued message.
- **The queued message**, in the runner, is a turn that waits for its feature's start, and is
  returned to the composer if the start is refused.
- **The proposal's request** writes the New page's title, its line, and its file in one server call,
  in place of five.
- **Live updates** resolve each changed record once per change, read from the cache, without the
  second resolve each subscription gets today.
- **The browser's cache** keeps every page's data read in the session, reads ahead the selected
  row's page, reads all cards' changes in one request, and gives each write fate's `optimistic`
  result.
- **The pages** load as separate chunks, all fetched once the first page is drawn.
- **The commit toast** and **the start's steps** draw the queue's record (mockups above).
- **The benchmark** drives the sandbox in a browser, on a release build. The server's
  `Server-Timing` header and the browser's user timings feed it, and the development warning.

Tradeoffs:

- The core keeps state between calls: a change the watcher misses shows stale data until the next
  one.
- A commit the server never ran, because it stopped first, stays as uncommitted changes on the
  commit page, though the UI showed it done.
- The browser holds every page read in the session in memory.

## Edge cases

| Importance | Situation                                          | What happens                                                                            |
| ---------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| High       | A hook refuses a commit after the human moved on   | what it showed is undone, its hook's output shows where it happened and in the toast    |
| High       | The server stops with commits queued               | their files stay written, uncommitted: the commit page lists them                       |
| High       | An agent or the human changes files outside Uraeda | the watcher drops the cache's part, and pages show the change within 1 second           |
| Normal     | Two tabs save the same file                        | the second write is refused as stale, read again, and retried once                      |
| Normal     | The start is refused: its slug is taken            | the editor stays, with "A feature named performance-pass exists already" under the slug |
| Normal     | The human leaves the session while its start runs  | the start and its queued message go on; the toast shows it                              |
| Normal     | A refused write, then the next one in the queue    | the queue goes on: each write is refused or lands alone                                 |
| Niche      | A page takes over 100 ms                           | the old page stays until it draws; a development build warns                            |
| Niche      | The human reloads while commits are queued         | the toast comes back from the server's queue                                            |

## Success criteria

- **SC-001** (100 ms): In the benchmark, on a release build over a repository of 69 features, every
  page drawn by a click or a key draws within 100 ms.
- **SC-002** (1 s): Every page drawn by a reload draws within 1 second.
- **SC-003** (100 ms): Every write's result shows within 100 ms of its press, a commit's included.
- **SC-004** (no wait): From Start, the session draws with its message within 100 ms. The human can
  send it and open another page with no step waited for.
- **SC-005** (1 s): A commit made outside Uraeda shows on its page within 1 second.
- **SC-006** (fresh worktree): Reads after Start made a worktree meet SC-001.

## Assumptions

The points settled in the clarifications, [to check](clarifications-01.md#check-these) and
[without the human](clarifications-01.md#settled-without-the-human), hold as written there, but one.
A page slower than 100 ms shows no bar, as your note asked. Settled while writing this spec:

- The release build of `vp run start` ships in its own change,
  [pull request #68](https://github.com/mrtolkien/uraeda/pull/68), before this feature: the targets
  assume a release build.
- The toast sits where the leader menu rises, over the status line, and the open menu covers it. On
  the phone, it sits over the bottom bar, across the screen's width.
- A refused write stays in the toast until opened or dismissed; Open goes to where it happened.
- The queue goes on past a refused write: Uraeda's own commits touch separate files.
- The start's message is the workflow's next step, known once the start is planned.
- The hook's output streams into the start's steps and the toast as it comes.
- The [surfaces](../ui/surfaces.md) and [space and motion](../ui/space-and-motion.md#speed) guides
  are rewritten to the toast and the queue, in the plan.
- The tab coming back to the foreground still reads its pages again, now from the server's cache.

## Constitution check

| I. Humans in control | II. Plain text | III. Async | IV. Review effort | V. Tools optional |
| -------------------- | -------------- | ---------- | ----------------- | ----------------- |
| ✅                   | ✅             | ✅         | ✅                | ✅                |

## Risk tier

**High**: a cache in the core and a write queue in the server are new services; a missed change
shows stale data, and a commit shown done can be undone.
