# Inbox

- Add notifications when there's a user action available
- Specs are still way too long and hard to read, with tens of bullet points (examples: "run ui")
- Allow no selection in responses (after a warning)
- Only true uraeda flows should show up in the UI -> `review-findings` was in the UI despite not
  having used the flow
- We can likely drop the nvim plugin and LSP... The WebUI is turning out just as good and working
  with worktrees in nvim is pretty hard. I like it for writing proposals though.
- Fix " ├╴ Link to non-existent document '/specs/2026-10-13-image-attachments/proposal.md' Marksman
  (2)"
  - Happens when there's a feature in a worktree: we should not link from main to worktree-only
    files
- Draft to proposal on mobile went 404
- We need a home icon/logo that goes back to the project root
- For UI work we need a few mock environments with fixed content. Once the environments exist, they
  can be used for reviews.
- We'll need a model selector for each step
- Make sure agents are resumable! -> highlight crashed/stopped sessions
- In failures the `x` is is not centered in the circle
- When the agent was blocked due to auto mode in claude code, there was no way to know except
  visiting the session page
- Text input still feels a bit laggy on sessions page, might be due to the huge page height
- We should have a way to have an agent be aware of multiple repos, for project spanning multiple
  repos and not in a monorepo
- Need a small "look at PR comments" button in features that restarts the agent and pushes it to
  check the comments
- Need to be able to rename a project slug, at least in the UI
- Priorities -> Draft should bring it children bullet point
- Add run options: "master session" vs 1 session per step.
- Allow to not select an option in clarifications in the web UI (but needs a comment)
