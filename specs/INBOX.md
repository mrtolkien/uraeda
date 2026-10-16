# Inbox

## Quickfixe

- Add notifications when there's a user action available

## Workflow

- Specs are still way too long and hard to read, with tens of bullet points (examples: "run ui")
- An important piece of work is making the clarifications and spec wording and style model-agnostic.
  We need to be extremely clear as to the format expected, the tone, ...
- Fix " ├╴ Link to non-existent document '/specs/2026-10-13-image-attachments/proposal.md' Marksman
  (2)"
  - Happens when there's a feature in a worktree: we should not link from main to worktree-only
    files

- We should have a way to have an agent/project be aware of multiple repos, for project spanning
  multiple repos and not in a monorepo

- Need a small "look at PR comments" button in features that restarts the agent and pushes it to
  check the comments + make sure it's part of the workflow (post-PR step)

## UI

- IMPORTANT: break down tasks in interface review (sidebars, ...) > pages review > flow and links >
  look and feel

- Priorities -> Draft should bring its children bullet point
- Text input still feels a bit laggy on sessions page, might be due to the huge page height
- Allow to not select an option in clarifications in the web UI (but needs a comment)
- Only true uraeda flows should show up in the UI -> `review-findings` was in the UI despite not
  having used the flow
- Draft to proposal on mobile went 404 -> look and feel
- For UI work we need a few mock environments with fixed content. Once the environments exist, they
  can be used for reviews -> Should be done with ui-iteration feature?
- In failures in the sidebar the `x` is is not centered in the circle
- Need to be able to rename a project slug, at least in the UI

- We need a home icon/logo that goes back to the project root

## Settings (later)

- We'll need a model selector for _each step_ once we have multiple models/runners
- Add run options: "master session" vs 1 session per workflow.

## Misc

- When the agent was blocked due to auto mode in claude code, there was no way to know except
  visiting the session page -> I think that was fixed
