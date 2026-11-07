---
kind: feature
finished: 2026-11-07
pull-request: https://github.com/mrtolkien/uraeda/pull/107
supersedes: [2026-10-16-storybook-warmup, 2026-10-17-storybook-restart]
---

# Record: Faster Storybook previews

> [!NOTE]
>
> The record of a merged feature, not instructions to follow. Started on 2026-11-07, finished on
> 2026-11-07, in [its pull request](https://github.com/mrtolkien/uraeda/pull/107). Its full files
> are in git: `git log -- specs/2026-11-07-storybook-previews/`.

## What and why

Story previews in rounds, specs, and sessions took 10 seconds or more to appear. Most of the wait
was a cold start: each branch's Storybook restarted at every commit, the human's submitted answers
included, and stopped 30 minutes after its last view, while the human read a round hours later. The
feature keeps one live Storybook per branch, restarts it less, keeps it up while something waits for
review, and compiles a story before showing it.

## Behaviour

- **Restarts**: a view restarts a checkout's Storybook only when its code version moved, a commit
  that changes a file outside `specs/`, or when its preview decision's command or folder changed. A
  commit under `specs/` alone, such as submitted answers, keeps the running Storybook and what it
  compiled. A code version that cannot be read counts as unknown, which never restarts a known one.
  Uncommitted edits to `.storybook/` still need "Try again".
- **Kept while waiting**: a feature's or a change's Storybook is not stopped for idleness while its
  step waits on the human with a file that embeds a story (a story link alone in its paragraph). It
  counts as viewed at each sweep, so it stops 30 minutes after nothing waits any more. Any other
  Storybook still stops after 30 minutes without a view; a removed worktree stops its Storybook,
  kept or not.
- **Started at boot**: as the server starts, the Storybooks of every waiting folder of every listed
  repository start one after the other, each once the previous one compiled its linked stories. A
  folder without `node_modules` in its preview folder starts nothing.
- **Compiled ahead**: when a feature's turn ends done, its Storybook starts, as before, and also
  compiles the stories its waiting file embeds.
- **No blank frame**: a story whose Storybook is ready reads "Starting Storybook for this branch…"
  until its code compiled, then shows its frame, updated live. A compile that fails or passes 60
  seconds counts as ended: the frame shows, with Storybook's own loader or error. Each story
  compiles once per running Storybook, shared by every page reading it.
- **Uraeda's own Storybook** starts faster: its fixture repository is built once per change of its
  sources, and each start copies it, about 0.6 seconds where the build took about 5.

## Design

The [preview runner](/packages/server/src/preview/runner.ts) still owns every Storybook process, one
per checkout, as the [preview decision](/specs/decisions/preview.md) asks. Three rules changed, each
with one owner:

- **When it restarts**: the core's [`code_version`](/crates/core/src/api/preview.rs), the id of the
  `HEAD` commit's tree with its `specs` entry left out, hashed but never written, exposed as the
  binding's `codeVersion`. The runner's `moved` compares it, with the command and folder, under the
  read-stamp rule that keeps an older read from moving a newer Storybook.
- **When it stops**: `Previews.sweep(kept)`, fed by the review watch,
  [`fate/preview-waiting.ts`](/packages/server/src/fate/preview-waiting.ts), which reads each
  folder's step and its waiting file's embedded stories through the core. The server's sweep tick
  ([`server.ts`](/packages/server/src/server.ts), `waitingPreviews`) skips a tick while the last one
  reads, and keeps nothing when the read fails. The same module starts the waiting Storybooks at
  boot and holds `warmPreview`, the turn's-end start.
- **When a story is ready**: the [warmer](/packages/server/src/preview/warmer.ts) fetches a story's
  page and its modules from the Storybook as a browser would, following static imports only, on the
  same server, each URL once, six at a time, with the preview base cut as the proxy cuts it. Vite
  compiles each module it serves and keeps it in memory, so the frame's own requests find them
  ready. [`compiles.ts`](/packages/server/src/preview/compiles.ts) holds one ready Storybook's
  compiles, aborted when it stops, fails, or is replaced, whose ends then send no update.
  `readStory` in [`fate/preview.ts`](/packages/server/src/fate/preview.ts) answers `starting` until
  the story's compile ended; `Previews.warm` compiles a list of linked stories one after another.

The process's start, watch, and kill moved to [`run.ts`](/packages/server/src/preview/run.ts), so
the runner stays under its size limit. The fake Storybook,
[`fixtures/preview/serve.mjs`](/fixtures/preview/serve.mjs), serves the checkout's source files,
lists what it served at `/__requests`, and holds them in mode `hold-modules` until `/__release`. The
fixture's cache lives in [`fixture.ts`](/packages/web/.storybook/fixture.ts), under
`packages/web/node_modules/.cache/uraeda-storybook-fixture/<key>/`.

Tradeoffs: about 1.5 GB of memory per branch waiting with stories, for as long as it waits; a commit
under `src/` still restarts, though live reload would often do; several Storybooks starting at boot
load the machine for a minute or more.

## Replaced behaviour

- **Every commit restarts the checkout's Storybook at its next view, a commit under `specs/`
  included.** Guarded by `runner.test.ts`'s commit tests, which now compare code versions, and by
  `preview.test.ts`'s "a view after a new commit in the checkout restarts its Storybook, and updates
  its stories", replaced by "a commit under specs/ keeps the Storybook; one outside restarts it,
  once (US2)".
- **A story is ready as soon as its Storybook lists its stories.** Guarded by `preview.test.ts`'s "a
  story's first read starts its Storybook, and turns ready live (US1.1)", which now passes through
  the compile; `frames.test.ts`'s "a story's frame and socket load under the secret, without a
  cookie" now waits for the story to turn ready.

## Gotchas

- **The warmer fetches, rather than using Vite's `server.warmup`**: measured on Uraeda's own
  Storybook under heavy load, a warmed page story drew in 1.2 to 2.6 seconds against 35 to 45 cold,
  while Vite's warm-up left 18 to 22 seconds, since it warms the story's file but not Storybook's
  own preview modules. Fetching also works with any project's Vite Storybook, with no change to the
  skill's helper.
- **The warmer never follows dynamic imports**: Storybook's stories module imports every stories
  file dynamically, and following them would compile the whole Storybook for one story.
- **The preview decision sits under `specs/`**: a commit of it alone moves no code version, which is
  why `moved` also compares the command and the folder.
- **The fixture's cached preview decisions name the temporary log of the start that built them**:
  the fake Storybook creates its log's folder, so the cached commands still run.
- **A compile's 60-second deadline is real time**, an `AbortSignal.timeout`, since only a signal
  reaches the warmer's fetches; its test sets `warmMs: 100`, as the index's tests set `indexMs`.

## Questions

### Round 01

#### Q1: How should story previews become fast?

**Answer:** A: keep one live Storybook per branch, make it restart less, stay up while there is
something to review, and compile its stories before showing them.

#### Q2: Which commits should restart a running Storybook?

**Answer:** A: only a commit that changes a file outside `specs/`.

#### Q3: How long should a Storybook keep running without a view?

**Answer:** A: keep a branch's Storybook running while one of its files waits for the human and
links a story, start it with Uraeda's server, and stop any other after 30 minutes.

#### Check these

- **The frame shows once the story compiled**, with "Starting Storybook for this branch…" until
  then.
- **The compile ahead is checked first**, on the real Storybook, before anything relies on it.

#### Settled without the human

- **Frames still load once on screen**, as the earlier warm-up change set.
- **"Try again" stays**, restarting at once whatever the restart rule.
- **Uraeda's sample data builds faster**, with no change to the stories.
- **The runner splits before it grows.**

## Changes after approval

- A changed preview command or folder restarts a Storybook at the same code version: the spec's
  "only a commit outside `specs/` restarts" left a fixed `preview-command`, committed alone, unused,
  and a failed Storybook failed at every view.
- The 1-second target for a warm view (SC-001) was measured only on a heavily loaded machine: the
  warmed story drew in a median of 1.96 seconds there, against 35 to 45 cold.

## Follow-ups

- Check SC-001's 1 second on a quiet machine, with a page story warmed ahead.
