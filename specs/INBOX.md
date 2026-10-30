# Inbox

- If there's nothing in progress, the "nothing in progress" in the sidebar looks weird
- Cross repo notes would be nice!
- I dislike moving buttons: for example on feature start, the composer jumps around

## Bugfix

- In a failed change (because inbox had uncommitted change: why the fuck does it block btw),
  clicking "go to proposal" didn't work.

## To test

## Deferred fixes

- [agent] [inbox-again] The leader key fixtures' spec and rounds still link the UI checks and UI
  coherence decisions, gone from `fixtures/realistic/decisions/`: in the sandbox those links open a
  missing decision (`fixtures/spec-leader-key/`, `fixtures/round-leader-key/`)
- [agent] [proposal-start] The New page's feature start lacks web tests of a start filled from an
  inbox note, of a hook refusing its commit, and of one with an image; `/new?kind=feature` is named
  twice, in `fate/starts.ts` and `session/StartingSession.tsx`; and `data.ts` and `views.ts` still
  call the slug proposal a typed change's
