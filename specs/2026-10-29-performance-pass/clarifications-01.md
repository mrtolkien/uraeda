---
status: awaiting-human
---

# Clarifications, round 01: Performance pass

> [!IMPORTANT]
>
> 6 questions, about 20 minutes.
>
> - Verdict: worth building, with changes: most of the slowness is a debug build and reads with no
>   cache, not missing optimism. Commits cannot be optimistic under an active decision.
> - Your server runs a debug build of the Rust core, about 4 times slower on every read. Shipping
>   the release build now, apart from this feature, is the first question.
> - Optimistic commits conflict with the UI behaviour decision, which forbids a guessed status. Its
>   rule on blocking other commits may change.
> - What "100 ms" measures and where values are cached work together: a cold read cannot reach 100
>   ms without a cache on the server.
> - The draft-to-feature flow can land at once on the feature's session, with its steps listed
>   there.
> - A new performance decision would keep the target once reached.
> - Check before the questions: every file write becomes optimistic, and a thin bar shows a page
>   that takes over 100 ms.

## Context

### Goal

The [proposal](proposal.md) asks for a UI that feels instant. Writes show their result at once,
values are cached ahead of time, and no page takes over 100 ms locally. Moving a draft to a feature,
over 10 seconds today, gets clear feedback.

### Today

Measured in this session, on this repository, by calling the Rust core directly:

| What                                        | Today (debug build) | Release build |
| ------------------------------------------- | ------------------- | ------------- |
| One read: a feature, the priorities, a file | about 400 ms        | about 95 ms   |
| Opening a proposal file                     | 931 ms              | 193 ms        |
| Each read, per freshly added worktree       | +3.3 s              | about +10 ms  |
| The draft-to-feature path, without hooks    | 20.7 s              | 3.3 s         |
| This repository's pre-commit hook           | 1.2 to 2.1 s        | same          |

- Every read rebuilds the whole workspace from every branch and worktree, with nothing kept between
  reads ([`api.rs`](/crates/core/src/api.rs)).
- `vp run start` builds the core's binding without `--release`
  ([`packages/binding/package.json`](/packages/binding/package.json)).
- The web UI has no prefetch, and keeps the data of 10 left pages. Pages chain 2 to 4 reads.
- About 10 of 95 write call sites show their result before the server answers: the priorities' and
  inbox's outliners, and a review comment.
- A draft becomes a feature through 2 page changes: the editor, then the session. Pressing
  Ctrl+Enter to start shows no feedback at all.

### Scope

Covered: how fast pages draw, what writes show while they run, the draft-to-feature flow, and how
the target is kept. Left out: the agent's own speed, and the git hooks of each repository, which
Uraeda runs as they are.

### Sources

- The core's reads and the binding's build, the server's live updates, the web UI's data hooks, and
  the start flow, linked above.
- Superhuman, Linear, GitHub Issues, VS Code, GitHub Desktop, and Codespaces; Nielsen's
  response-time limits and Google's RAIL model.
- fate 1.12.1's installed docs, and React's Suspense and transitions.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **Every file write becomes optimistic**: saving text, answering, commenting, moving notes and
  proposals, settings, sending a message to the agent. The proposal asks for "everywhere", and the
  [space and motion](../ui/space-and-motion.md#speed) guide already does. A refused write puts the
  result back and says why where it happened. See
  [discovery](discovery-01.md#optimistic-file-writes).
- **What only the core computes is never guessed**: a new proposal file's path or a feature's step
  shows as "Writing…" until the server answers. The [stack](../decisions/stack.md) decision keeps
  that logic in the core. See [discovery](discovery-01.md#rules-and-their-owners).
- **A page not drawn after 100 ms shows the thin top bar** over the old page, as a commit does
  today. Under 100 ms nothing shows, so a quick page never flashes. See
  [discovery](discovery-01.md#navigation-feedback).
- **The server keeps the whole workspace in memory first**, dropped by the watcher on any change.
  Splitting it by branch waits until a measure asks for it. See
  [discovery](discovery-01.md#server-reads).
- **fate moves from 1.12.1 to the latest 1.12 or 1.13**: 1.12.2 fixed optimistic inserts lost during
  background refreshes, which live updates cause. See [discovery](discovery-01.md#fate-1121).

## Q1: Should the release build ship now, apart from this feature?

Your server, started with `vp run start` from the main checkout, loads a debug build of the Rust
core. Every read takes about 400 ms instead of 95. Each new worktree adds about 3 seconds to every
read until git refreshes it. That alone turns the draft-to-feature path from about 3 seconds into
about 20. More in [discovery](discovery-01.md#where-the-10-seconds-go).

The fix is one flag on the binding's build. A release build takes about a minute when the core
changes, against seconds for a debug one.

Why it matters: it is the largest gain of the whole pass, and it can reach you days before the rest.

- **A (recommended). Ship the release build for `vp run start` now, as its own change, and keep the
  debug build for `vp run dev` and tests.**
  - [pro] every page about 4 times faster within a day.
  - [con] a start after a change to the core rebuilds for about a minute.
  - Why recommended: the biggest gain for the smallest change, with no choice left open.
- **B. Ship it inside this feature, with the rest.**
  - [pro] one pull request for the whole pass.
  - [con] the slowness stays until the feature merges.
- **C. Use the release build everywhere, `vp run dev` and tests included.**
  - [pro] what you try in development matches what you run.
  - [con] every core change in a worktree rebuilds for about a minute.

**Answer:**

## Q2: What should "no page over 100 ms" measure?

Example: you click a feature in the sidebar. Today its page draws after 2 to 4 chained reads, each
about 95 ms in a release build.

A page from cached data can draw in one frame. A page that waits for data waits for its reads, and
React shows waiting content at most every 300 ms. A reload first parses the whole app. A commit runs
your hooks, which take what they take. Where values are cached is Q3: this answer sets how far it
must go. More in [discovery](discovery-01.md#what-100-ms-means).

Why it matters: it decides what the pass must build, and what a later check holds every change to.

- **A (recommended). Every click and key shows its first feedback within 100 ms, and every
  navigation draws within 100 ms. A reload draws within 1 second, and a commit shows its action at
  once.**
  - Example: the feature's page draws in under 100 ms, whether you visited it before or not.
  - [pro] the whole app feels instant, as Superhuman's 100 ms rule asks.
  - [con] needs a cache on the server (A or B in Q3).
  - Why recommended: it is the proposal's target where it can hold, and says where it cannot.
- **B. Only pages already visited or prefetched draw within 100 ms; others may take a few hundred
  milliseconds.**
  - Example: the feature's page draws in about 300 ms the first time, then at once.
  - [pro] reachable with prefetch alone.
  - [con] the first visit of each page still lags.
- **C. Every page within 100 ms, a reload included.**
  - Example: reloading the feature's page draws it in under 100 ms.
  - [pro] nothing ever lags.
  - [con] needs the data kept on disk in the browser, and the app cached by a service worker.

**Answer:**

## Q3: Where should values be cached ahead of time?

Example: you open the inbox, then a feature, then come back to the inbox.

GitHub Issues renders from a cache in the browser, refreshed behind it, and fetches likely pages
ahead. Superhuman keeps a local database. Uraeda's server could keep its reading of the repository
in memory, dropped when a file or branch changes. fate, the web UI's data layer, can fetch ahead and
keep data across reloads. The latter needs a new package, `@nkzw/fate-indexeddb`. The target this
must reach is Q2. More in [discovery](discovery-01.md#caching-ahead-on-the-client).

Why it matters: a cache on the server is what makes a cold page fast. A cache in the browser makes
reloads fast, at the cost of a stale first frame.

- **A (recommended). The server keeps its reading of the repository in memory. The browser fetches a
  link's page on hover or focus, and the likely next pages.**
  - Example: the inbox and the feature draw from memory, each a few milliseconds on the server.
  - [pro] every navigation under 100 ms, with no new dependency.
  - [con] a reload still waits for its first reads, about 100 ms each.
  - Why recommended: it meets A in Q2 with what is installed.
- **B. A, plus the browser keeping data on disk across reloads, through `@nkzw/fate-indexeddb`.**
  - Example: after a reload, the inbox draws its last data at once, then refreshes.
  - [pro] reloads draw at once.
  - [con] a new dependency, and a first frame that may show data a moment old.
- **C. The server's cache only, nothing fetched ahead.**
  - Example: each page is one round trip of a few milliseconds.
  - [pro] the smallest change.
  - [con] every click still waits for its round trip, likely just over 100 ms with the page's work.

**Answer:**

## Q4: How should a commit show while it runs?

Example: you approve a spec, which commits and runs your pre-commit hook for about 2 seconds.
Meanwhile, you want to answer a question in another feature.

The [UI behaviour](../decisions/ui-behaviour.md) decision says a git write "MUST show its action at
once and never a guessed status". It also "MUST block other git writes until it ends". It came from
your request for "EXTREMELY CLEAR feedback" on commits. VS Code shows a commit as done before git
confirms it, and reconciles after. A hook can refuse a commit, which an optimistic result would then
undo. More in [discovery](discovery-01.md#git-writes).

Why it matters: it changes an active decision, and decides whether optimism reaches commits.

- **A (recommended). A commit shows its action at once on its button and its card. Another commit
  queues behind it instead of being blocked.**
  - Example: the spec reads "Approving…"; your answer's commit waits its turn and runs after,
    without you waiting.
  - [pro] you never wait for a commit to start the next one.
  - [con] the decision's blocking rule becomes a queue: a commit refused by a hook can leave the
    next one waiting on your fix.
  - Why recommended: it keeps commits honest and removes the wait.
- **B. Keep the decision as it is: the action at once, other commits blocked until it ends.**
  - Example: the answer's button is disabled for 2 seconds.
  - [pro] no change to the decision; one commit at a time is easy to follow.
  - [con] every commit still stops the others.
- **C. A commit shows its result at once, as if done, and undoes it if a hook refuses.**
  - Example: the spec shows "Approved" at once, and goes back to waiting if the hook fails.
  - [pro] nothing ever waits.
  - [con] removes the decision's rule; you may act on an approval a hook then refuses.

**Answer:**

## Q5: How should a draft become a feature?

Today, Start in the editor commits the proposal, makes the branch and its worktree, then opens the
feature's session. The composer fills a moment after the page. The button's label is the only
feedback, and Ctrl+Enter skips it. With a release build, the start takes about 2 seconds plus your
hook. Codespaces lands on one page that names each step, and hands control back as soon as it can.
More in [discovery](discovery-01.md#the-start-flow).

Why it matters: it is the flow the proposal names, and it sets how every long write shows its
progress.

D can come on top of A, B, or C.

- **A (recommended). Start lands at once on the feature's session, which lists the steps as they
  run. They are committing the proposal, with your hook's output, then making the branch and
  worktree. The composer fills when they end.**
  - [pro] one page change, and you watch the steps where you will work next.
  - [con] the session page shows a feature not yet on its branch for a few seconds.
  - Why recommended: no page change waits for git, and each step is named, as the proposal asks.
- **B. The editor lists the steps as they run, then opens the session once they end.**
  - [pro] the session only ever shows a feature that exists.
  - [con] you wait on the editor before the page you came for.
- **C. Keep today's flow, made faster by the other answers.**
  - [pro] nothing to redesign.
  - [con] still two page changes, and no named steps.
- **D. On top: the New page's dialog also asks the slug, and starts the feature straight from it,
  skipping the editor.**
  - [pro] a draft typed in one go becomes a feature in one action.
  - [con] the proposal is committed without a look at it in the editor.

**Answer:**

## Q6: Should the target become a lasting rule?

Once reached, the target can drift with each feature. The
[code quality](../decisions/code-quality.md) decision forbids tests that depend on elapsed time,
except benchmarks of a spec's success criteria. Figma runs performance checks on every pull request
with a 20% margin. Timing tests already exist, such as a commit's live update under 2 seconds. More
in [discovery](discovery-01.md#guarding-the-budget).

Why it matters: a decision makes every later feature keep the target, and says how it is checked.

- **A (recommended). A new decision, Performance, states the target of your answer to Q2. A
  benchmark over the sandbox checks it on demand, and a warning shows in development past 100 ms.**
  - [pro] every feature keeps the target, at no cost to each push.
  - [con] a regression shows only when the benchmark runs or the warning appears.
  - Why recommended: it keeps the target without the noise of timings in every check.
- **B. The same decision, with the benchmark run by `vp run ready` before every push, with a
  margin.**
  - [pro] a regression is caught before it is pushed.
  - [con] a browser run in every `ready`, and timings that vary with the machine.
- **C. No decision: a one-time pass.**
  - [pro] nothing to maintain.
  - [con] the target drifts unseen.

**Answer:**

## Settled without the human

### Behaviour

- **A message sent to the agent** shows in the session at once, before the server stores it. See
  [discovery](discovery-01.md#optimistic-file-writes).
- **Ctrl+Enter and Enter in the slug** start a feature with the same feedback as the button: today
  they show nothing. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **No "commit without hooks"**: the [git](../decisions/git.md) decision forbids bypassing hooks. A
  refused commit shows the hook's output where it happened, as today. See
  [discovery](discovery-01.md#needs-no-choice).

### Under the hood

- **Each record a page reads is resolved once**: the server stops resolving each subscription a
  second time right after it subscribes. See [discovery](discovery-01.md#important-reads).
- **Live updates are coalesced**: one change re-sends each record once, read from the cache. See
  [discovery](discovery-01.md#important-reads).
- **A write takes its base from the cache**: the read before each write goes. A write the server
  refuses as a conflict reads again and retries once. See
  [discovery](discovery-01.md#important-reads).
- **The server's thread pool grows** past Node's 4 threads, so a slow commit does not hold back
  reads. See [discovery](discovery-01.md#important-reads).
- **A new worktree's index is refreshed** after `git worktree add`, if the plan's first measure
  confirms it removes the slow reads. See [discovery](discovery-01.md#where-the-10-seconds-go).
- **Pages load as separate chunks**, so a reload parses only what it draws. See
  [discovery](discovery-01.md#needs-no-choice).
- **Timings are reported**: the server sends a `Server-Timing` header, and the existing timing tests
  take the new bounds. See [discovery](discovery-01.md#likely-changes).

**Notes:**
