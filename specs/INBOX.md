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
