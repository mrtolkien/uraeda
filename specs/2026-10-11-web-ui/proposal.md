# Web UI for the workflow files

## What

Create a Web UI to:

- View all steps of the workflow in an easy to read layout, with nice hierarchical information
- Edit human steps: draft, update to proposal, clarification, spec review, plan review

## Why

It's high priority because at the moment it will be my main way to interact with this project. This
is dogfooding.

## Rendering

- Render the workflow files with the Markdown flavour the skill defines (see "Markdown" in
  [the skill](../../skills/uraeda/SKILL.md)): callouts, typed bullets (`[pro]`, `[con]`, ...), list
  callouts, tables.
- Use the structured items to render more than Markdown: a clear hierarchy between a user story's
  description and its acceptance scenarios, options with their pros and cons, follow-up questions
  shown under their parent.
  - For example, each question in the clarification should be a card, with the answers 3 options,
    and a free form text input for extra comments (like most coding agents "clarify" tool)

## Note

- Look at the /specs/drafts/cli-tuis.md file for UI layout inspiration, I already outlined the ideas
  I had there
- The web UI should be a React + Astryx + Fate full stack app:
  - It uses the Rust core to navigate the files and perform any workflow action
  - It uses Fate for data fetching, maybe you need to make a custom Fate adapter
- As of right now, it should simply run at the root of the repo where we want to show the web-ui. In
  the uraeda folder itself, we should be able to do `vp dev` and run the web-ui for uraeda itself.
- Changes to a file without finishing a review/clarification simply saves the file
- Comitting changes does not trigger anything at the moment
- No need for any security, I'll run it on my machine and access it through Tailscale only
- The UI should work well on mobile, I'll be using it from my iPhone.
- For the moment, focus on the layout and readability, not the look and feel
- Use the relevant Astryx components, read the Astryx quickstart if needed
