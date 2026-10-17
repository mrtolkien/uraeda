# Inbox

## Quickfixes

- Fix " ├╴ Link to non-existent document '/specs/2026-10-13-image-attachments/proposal.md' Marksman
  (2)"
  - Happens when there's a feature in a worktree: we should not link from main to worktree-only
    files
  - There's no simple fix atm, because the file is only in the worktree: we should likely change the
    commit/worktree flow a bit
- Draft to proposal on mobile went 404
- Ongoing tasks should be their own category in priorities (when starting a feature/change)
- When there's multiple "blocked by auto mode", we should be able to allow them ALL at once!
- Setup coverage visualisation (could be a simple command for this project, loclly)
  - Also understand why the coverage job takes so much time?
- [agent] [storybook-warmup] vp install in a new worktree rewrites the Vite+ section of AGENTS.md
  without its line wrapping, so vp check fails until it is restored
- [agent] [storybook-warmup] Under vp run ready, server test files that run sessions sometimes fail
  on test-setup.ts's afterAll (10 s hook timeout, removing the temporary folder), which stops the
  browser suites; they pass alone
- We need a "restart stopped agents" button after a crash, that just sends "continue" in all
  sessions

## Prompts

- Do we really need the `/uraeda:uraeda` in prompts ?
  - Generally we should take a look at all session transcripts so far and check if our prompts
    behaved properly.
  - Example: the UI branch asked for a clarification that would help finish the branch and the
    auto-filled message asked to go back to spec (normal for the standard flow). But it could
    directly finish the PR without all the flow again... We need a way to shortcut the flow for
    later clarifications
- We need a dedicated "testing setup" reference which covers storybook and component testing, and
  should only be read rarely (during the flow setup or when UI work starts) -> it should then be
  made into a repository-specific decision
- Should we split the files in two:
  - A first file that the model writes with light constraints -> this way we let the model write
    what it would do "normally"
  - Then we transform the file into a second, human-readable, actionable document?
  - The idea would be let the model make a first "draft" that's extensive, _then_ extract the most
    important information, well formatted, for a human
- We need a "check decisions coherence" option, like "inbox triage"
  - It should read constitution and all decisions and raise if some of them are competing, and
    explain the options clearly (what are the 2 options to keep it clean)

## UI

- [agent] [redesign-priorities] Once the interface and priorities redesigns are merged, review the
  sidebar: a grey count of inbox notes on the Inbox row, and a Decisions row above Done
- Add icons to decisions?

## Flow

- Settings page didn't show as "finished" in the UI after the last message -> might be fixed by the
  interface review feature
- Decisions are hard to read and too long, will need a pass
- Clarifications during implementation can resume implementation

## Deferred fixes

- [agent] [redesign-priorities] Decisions page: when the default branch is checked out nowhere, a
  decision's links are checked against the current checkout, not the default branch's tree, so a
  valid link can read as broken
- [agent] [redesign-priorities] Home's Now count includes started entries, while the priorities
  page's Now · N leaves them out
- [agent] [redesign-priorities] ura note still refuses when other files are staged, while the web
  UI's Add and commit commits the file alone
- [agent] [redesign-priorities] Discard keeps a priority's draft on disk when the line's children
  changed since the last commit
- [agent] [redesign-priorities] The decisions page runs one git log per decision, and the watch
  reads every decision on each pass
- [agent] [redesign-priorities] The editor's hint says draft for an entry linking a backlog file
- [agent] [redesign-priorities] List keys under an open menu or dialog are handled but untested:
  only an open Selector is tested
- [agent] [redesign-priorities] Under the full browser run, story-variants' comment test sometimes
  fails: userEvent.click turns the found element back into a locator by its label, which matches
  both variants' Pick buttons
