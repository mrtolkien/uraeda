# Inbox

- If there's nothing in progress, the "nothing in progress" in the sidebar looks weird
- Cross repo notes would be nice!
- I dislike moving buttons: for example on feature start, the composer jumps around

## Bugfix

- In a failed change (because inbox had uncommitted change: why the fuck does it block btw),
  clicking "go to proposal" didn't work.
- [agent] [reading-pass] Starting a proposal moves its file but leaves the links to it in
  `specs/done/` records: three starts on 2026-10-30 broke three links in the inbox-again record, and
  `ura check`, part of `vp run ready`, failed on the default branch until they were fixed
- [agent] [reading-pass] The Reading and layout pass's start made a feature, branch
  `2026-10-30-reading-pass` and folder `specs/2026-10-30-reading-pass/`, while its session's first
  message continued it as a change, in `specs/changes/`: it was moved by hand

## To test

## Deferred fixes

- [agent] [reading-pass] The phone's snug pane room is opt-in, pane by pane (`isSnugOnPhone`): a new
  pane on a reading page silently keeps the wide room, as six did in this change. A reading page's
  context read by `Pane` would give the rule one home; and `specs/ui/phone.md` should name a
  feature's record among the pages whose panes are snug
- [agent] [inbox-again] The leader key fixtures' spec and rounds still link the UI checks and UI
  coherence decisions, gone from `fixtures/realistic/decisions/`: in the sandbox those links open a
  missing decision (`fixtures/spec-leader-key/`, `fixtures/round-leader-key/`)
