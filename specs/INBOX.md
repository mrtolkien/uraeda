# Inbox

- If there's nothing in progress, the "nothing in progress" in the sidebar looks weird
- Cross repo notes would be nice!
- I dislike moving buttons: for example on feature start, the composer jumps around

## Bugfix

- In a failed change (because inbox had uncommitted change: why the fuck does it block btw),
  clicking "go to proposal" didn't work.

## To test

## Deferred fixes

- [agent] [feature-state] Right after an agent pushes to an open pull request, the feature can read
  "Needs attention" and notify "The run stopped before a gate" until the next check of `gh`: the
  Push step waits on the agent, and a run that ends there reads as halted
  (`packages/server/src/runner/status.ts`)
- [agent] [feature-state] A failed or stopped run at a step that waits on the human reads "Needs
  you", never "Needs attention", so it offers no Dismiss, and asks again once the step moves to the
  agent; its dismissed row in `runner/__tests__/status.test.ts` passes before the dismissal is read
- [agent] [feature-state] A pull request merged on GitHub, not fetched, makes its feature done
  without its number: the feature page's "Merged" has no pull request to open
  (`crates/core/src/pulls.rs`)
- [agent] [feature-state] The workspace record's `running` is read by no view any more: remove it,
  or name what reads it (`packages/server/src/fate/sources.ts`)
- [agent] [inbox-again] The leader key fixtures' spec and rounds still link the UI checks and UI
  coherence decisions, gone from `fixtures/realistic/decisions/`: in the sandbox those links open a
  missing decision (`fixtures/spec-leader-key/`, `fixtures/round-leader-key/`)
