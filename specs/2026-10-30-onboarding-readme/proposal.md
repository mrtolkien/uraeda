---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Onboarding + README pass

## What

Onboarding + README pass: claude setup, what to read and in which order, what to install, ...

- Easy to read human guide in README.md
  - Highlight that at the moment it relies on a local Claude Code install ONLY.
- Onboarding in the UI: highlight missing core files (constituition, testing decision, ...)
- Setup with agent (checks project and creates relevant files)
  - There should be a "setup project with agent" button in the UI, very visible and in the home, if
    the project is not ready to be used with Uraeda. Pressing it should open a session with a
    pre-filled message telling the agent to read the Uraeda skill and templates and help the user
    set up missing files.

## Why

The workflow and files are well defined and the vocabulary is good now. It's time to make it easy to
understand for humans.

## Notes

README should be short and easy to read. Use the Uraeda logo, make a small SVG banner for the intro,
and make sure the README looks and reads _appealing_ to a human. It needs to be extremely clear what
uraeda is: first of all a workflow. Then a CLI to enforce the workflow. Then a web UI to control the
workflow. Agents should pull the skill and read it, the README is not documentation for them.
