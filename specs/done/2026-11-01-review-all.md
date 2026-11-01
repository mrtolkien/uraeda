---
kind: change
finished: 2026-11-01
pull-request: https://github.com/mrtolkien/uraeda/pull/85
---

# Record: Review all the inbox entries

> [!NOTE]
>
> The record of a merged change, not instructions to follow. Started on 2026-11-01, finished on
> 2026-11-01, in [its pull request](https://github.com/mrtolkien/uraeda/pull/85). Its full files are
> in git: `git log -- specs/changes/2026-11-01-review-all/`.

## What and why

The human asked for every inbox entry to be reviewed, the fixable ones fixed, and low-importance
bugs with no impact on usability dropped, asking only for decisions they must make. The inbox held
eleven agents' notes under **Deferred fixes**, left by the feature-state, reading-pass, inbox-again,
mockup-previews, and proposal-start work. Seven were fixed, four dropped, and none needed the
human's decision. The inbox is now empty.

## Behaviour

- **A push to an open pull request moves the step at once.** An open pull request whose head, as
  `gh` last read it, lacks the branch's tip is Push only while the local branch is not at
  `origin/<branch>`. Right after an agent pushes, the step is the human's pull request, not Push
  until the next fetch of the pull requests, so the run no longer reads "Needs attention" or
  notifies "The run stopped before a gate". A branch committed after its last push is still Push.
- **A failed or stopped run asks until dismissed, at a human gate too.** A session's latest run that
  failed or was stopped, not dismissed, reads "Needs attention", with Dismiss, even when the step
  waits on the human; once dismissed, the step's "Needs you" shows. Before, the gate hid the
  failure, which came back as "Needs attention" once the human had answered.
- **An agent's image whose name holds a percent-encoded character draws**, as `my%20shot.png` in a
  session, as it did in a page.
- **An SVG whose doctype is in mixed case, or closes its internal subset as `] >`, draws**: XML
  allows whitespace before the doctype's `>`.
- **The sample features link the decisions as they are now**: the leader key round and spec, and the
  plan page's plan, link UI components and Testing in place of the merged UI coherence and UI checks
  decisions, and the plan page quotes their current rules.
- **The phone guide** names a merged feature's record among the snug panes, its feature page's own
  panes keeping their room, and says each reading pane opts in with `isSnugOnPhone`.
- **Code only**: the Workspace record's `running`, read by no view, is gone; the New page's Feature
  address, `/new?kind=feature`, written five times, has one home that the server's refused start and
  the web share.

## Design

- **Push**: `PullRequests::state` in [`pulls.rs`](/crates/core/src/pulls.rs) checks `pushed`, the
  local branch at its remote tip, which `merged` already used. The watcher reports a push, as the
  remote-tracking ref moves, so the step is read again on that burst.
- **Status**: [`runner/status.ts`](/packages/server/src/runner/status.ts) reads an undismissed
  failed or stopped run before the step that waits on the human.
- **Agent images**: `repositoryPath` in [`AgentStories.tsx`](/packages/web/src/AgentStories.tsx)
  decodes the path before `imagePath` encodes it again, keeping a malformed encoding as written.
- **SVG**: `is_svg` and its new `after_doctype` in [`images.rs`](/crates/core/src/images.rs).
- **The Feature address**: `NEW_FEATURE_HREF` in [`hrefs.ts`](/packages/server/src/hrefs.ts),
  exported as `uraeda-server/hrefs`, free of Node's modules.
- **Fixtures and guide**: [`fixtures/spec-leader-key/`](/fixtures/spec-leader-key/),
  [`fixtures/round-leader-key/`](/fixtures/round-leader-key/),
  [`fixtures/plan-page/plan.md`](/fixtures/plan-page/plan.md), and
  [`specs/ui/phone.md`](/specs/ui/phone.md).

Dropped, with why:

- **A pull request merged and not fetched loses its number on the feature page**: it does not
  reproduce. The branch's record names the pull request, and the feature view reads its number from
  there (`recorded_pull_request` in [`view/feature.rs`](/crates/core/src/view/feature.rs)); only a
  feature merged without the finish step lacks it.
- **In Firefox, an SVG in an `<img>` follows the OS's colour scheme**: it does not reproduce.
  Firefox 155, headless, draws an SVG's `prefers-color-scheme` styles in the page's `color-scheme`,
  which Astryx sets on `<html>` from the picked theme, as Chromium 153 does.
- **A clicked link to an SVG in `mockups/` runs its scripts**: they run sandboxed in an opaque
  origin, as every HTML mockup's do, which the
  [links test](/packages/web/src/__tests__/links.test.ts) states as the intended route.
- **The snug panes as a page-wide context**: the feature's page mixes the record's snug panes with
  roomy ones, so a context would still need an exception per pane, across 25 call sites, for no
  change a user sees.
- **Web tests of the New page's feature start** from an inbox note, a refused hook, and an image:
  the [testing decision](/specs/decisions/testing.md) tests the UI rarely at the `early` stage, and
  the server's start tests own the git writes.

## Gotchas

- **The shared address lives in a module free of Node's modules**: a browser module importing a
  value from `uraeda-server/fate` loads the server's code in Vite's dev server and the sandbox, and
  the page stays blank on `node:path`, while the production build passes, as tree-shaking drops it
  ([`hrefs.ts`](/packages/server/src/hrefs.ts)).
- **A remote moved back outside this clone**, unfetched, to a commit the branch holds, reads as
  pushed: the pull request waits on the human until the next fetch
  ([`pulls.rs`](/crates/core/src/pulls.rs)).
