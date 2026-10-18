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

## UI

- In clarifications of inbox triage, most notes were cut -> very hard to read
  - Also the card with two columns + questions on the right felt a bit cramped, the card should be a
    bit wider + the right column should be right-aligned

## Flow

## Deferred fixes
