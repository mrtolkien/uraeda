---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Redesign session

## What

A functional pass on the session page.

- Opening a big session is slow and laggy: I want the full UI to feel instant, the UI should only be
  passed the last X messages by default
- Text input still feels a bit laggy on sessions page, might be due to the huge page height
- Reading the messages on mobile is extremely hard, take inspiration from Gemini/Claude/ChatGPT
  mobile UIs. There's way too much padding, borders, ...
- There should be a different color for user messages vs agent messages
- When there's multiple "blocked by auto mode", we should be able to allow them ALL at once!
- All relevant buttons should be at the BOTTOM of the page, next to the composer
- In a standard chat on desktop, the right sidebar is empty: it should have a list of file changes
  made in this chat at least (based on tool calls maybe, in case it's on main?). Also sources
  checked (online links, files, ...). Suggest good content for the right sidebar, take inspiration
  from existing chat web UIs.

## Why

The session is where the human follows and talks to the agent: it should feel instant.

## Notes

- When the agent was blocked due to auto mode in claude code, there was no way to know except
  visiting the session page -> I think that was fixed, check it
