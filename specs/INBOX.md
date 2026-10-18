# Inbox

## Quickfixes

- Fix " ├╴ Link to non-existent document '/specs/2026-10-13-image-attachments/proposal.md' Marksman
  (2)"
  - Happens when there's a feature in a worktree: we should not link from main to worktree-only
    files
  - There's no simple fix atm, because the file is only in the worktree: we should likely change the
    commit/worktree flow a bit

## Prompts

- The implement step creates WAY TOO MANY inbox notes: inbox notes should be _meaningful_ issues
  that require human attention. If it's random bullshit why is it here, if it's important why isn't
  it done.

- The PR texts suck: I often work on 3+ features in parallel and when a PR drops I'm lacking
  context. It talks about "Approach" and "What stays unchanged" but ffs start with some good context
  about what was _done_.

## UI

- In clarifications of inbox triage, most notes were cut -> very hard to read
- In clarifications the card with two columns + questions on the right felt a bit cramped, the card
  should be a bit wider + the left part should be bigger + the right column should be right-aligned
- The sidebar view of running stuff needs a few changes:
  - Click in most of the border should go to the page (feature/change)
  - The agent pill should go to the session
  - If it's a warning sign for answers it should go to the question page
  - The diff needs colors (green/red)
  - We need ~+2px bottom border I think, sometimes text and pills looked like they had not enough
    space (don't have an example on hand)

## Changes

- Inbox needs to be able to have screenshots like other pages
- Questions need examples + the text has become too long with the new prompt
  - The question could present the example and the answers the outcome
- "drafting a priority" is ass btw. It should be "Turn a priority into a draft".

## Deferred fixes

- [agent] storybook-fixes: validate-storybook.ts starts Vite and lists the repository outside its
  `try`, so a failure there leaks its two temporary folders, and `storybookPage` and
  `checkoutFolder` copy the core's page-route and branch-to-folder rules
- [agent] [redesign-feature] Feature page: a decision a done feature renamed shows as new, its old
  name untouched: the diff's rename keeps only the new path
- [agent] [redesign-feature] Problems: a blank answer blocks a feature only when its branch is
  checked out; a branch without a checkout never shows "Fix"
- [agent] [redesign-feature] Feature page: Back after a reload can land too high: "Next", the
  agent's card, and the record draw after the scroll is restored
- [agent] [redesign-feature] Feature page: a change's blocking banner reads "This feature cannot go
  on"
- [agent] [redesign-feature] Code quality: structure.rs still allows workspace.rs 742 lines, though
  it is 659 now: lower the budget so it cannot grow back
- [agent] [redesign-feature] Runner: a workflow message queued on a feature merged before it starts
  fails with "This feature has no branch left"
- [agent] [redesign-feature] Runner: the steps whose run starts a fresh agent session are listed
  twice, in HandOver.tsx and runner/sessions.ts
- [agent] [redesign-feature] Tokens: agent session starts are found by their system line's words:
  rewording a line loses the markers already stored
- [agent] [redesign-feature] Tokens: a late report from a closing process can count for the next
  turn; the session's total stays right
- [agent] [redesign-feature] Feature page: the stages' walk stops at the folder's date minus a day:
  commits made earlier, or reachable only through an older-dated commit, are missed
- [agent] [redesign-feature] Feature page: a feature fast-forwarded into main locally is timed as
  merged at its finish, not at the merge
- [agent] [redesign-feature] Feature page: a done item read from its folder, with no record, walks
  the default branch from its tip to the folder's date
