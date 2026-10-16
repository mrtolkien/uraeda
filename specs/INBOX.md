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
