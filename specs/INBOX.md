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
- [panes-size] Remove the selector on the `+` button, it should open the new page which has more
  context

## Bugfix

- [agent] [review-inbox] A note whose marks end its first line, promoted to the priorities or a
  proposal, leaves a `- ` line with a trailing space before its link (`inbox.rs`'s `unmarked_lines`)
- [agent] [review-inbox] A start whose link rebase fails on the second file of a postponed folder
  names neither the first, rebased, nor the files after it (`start/commits.rs`)

## Deferred fixes

- [agent] [onboarding-readme] "Set up with the agent" keeps a session draft already on the New page,
  so Send sends that text, not the setup message, with no hint (`NewPage.tsx` `useSetupMessage`)
- [agent] [onboarding-readme] Under reduced motion the Setup pane's room never fires
  `transitionend`, so the closed pane stays mounted, hidden (`layout/Room.tsx`)
- [agent] [onboarding-readme] As the Setup pane closes, its title reads "Setup · 0" for 200 ms
  (`home/Setup.tsx`)
- [agent] [onboarding-readme] The README has 24 words left under its 1,000-word limit, and nothing
  checks it
- [agent] [onboarding-readme] `fixtures/realistic/decisions/` lacks the documentation decision, so
  the sandbox's and the screenshots' Decisions page does not show it
- [agent] [onboarding-readme] `specs/ui/components.md` does not list `layout/Room.tsx`, now shared
  by the column's Unfold and Home's Setup pane
- [agent] [onboarding-readme] `readme-screenshots.ts` waits for the realistic project's turns only
  after the first page load starts them: a change in `serveUi`'s start callback breaks it

## To test

- See if we can integrate Claude Design
