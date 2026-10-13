---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Chat in the web UI

## What

Ask about a step without committing, see the final message before handoff, ask questions about the
spec or plan, ...

## Why

We have started orchestrating claude and it works pretty well, now I want to add the last feature
I'm using from driving claude code from the CLI: back and forth chats

## Notes

- The UI should have a dedicated "session" view inspired by coding agents (claude code, code, pi,
  opencode) and chatbot uis (chatgpt, gemini, claude, ...)
- The sessions should be searchable and viewable in the side bar, with an indication of their
  current status
  - You can take inspiration from herdr: https://herdr.dev/, which is a terminal multiplexer built
    for agents
- While we only support claude, we'll also support Codex and Pi-durable soon: the concepts need to
  be generic and the data model + UI need to be properly abstracted
- We should be able to start a session in the project without a feature attached to it, like a
  normal coding agent
