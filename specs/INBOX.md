# Inbox

- [decisions-needs] Need a bit more left/right padding on mobile and slightly smaller text (same as
  discord messages on mobile)
- [decisions-needs]
  [The "replaced behaviour" block looks weird in the specs. Needs a review together with decisions changes.](notes/the-replaced-behaviour-block-looks-weird-in-the/note.md)
- [The home columns are not centered on a wide screen](notes/the-home-columns-are-not-centered-on-a-wide-screen/note.md)
- [performance-pass] http://127.0.0.1:4310/r/uraeda/f/2026-10-29-performance-pass/spec.md -> the
  mockups didn't work at all locally
- [onboarding-readme]
  [Couldn't preview an SVG or see it in the proposal. Should be pretty easy to show it.](notes/couldn-t-preview-an-svg-or-see-it-in-the-proposal/note.md)
- "Proposal > Start" should not append, creates really weird beahviour
- The proposal start flow sucks ass when it's from a single priorities row > after "new feature
  start" it should be at the session page...

## Bugfix

- [agent] [review-inbox] A note whose marks end its first line, promoted to the priorities or a
  proposal, leaves a `- ` line with a trailing space before its link (`inbox.rs`'s `unmarked_lines`)
- [agent] [review-inbox] A start whose link rebase fails on the second file of a postponed folder
  names neither the first, rebased, nor the files after it (`start/commits.rs`)

## To test

- See if we can integrate Claude Design
