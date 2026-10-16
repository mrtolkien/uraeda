---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Redesign session

## What

A functional pass on the session page.

- Opening a big session is slow and laggy: I want the full UI to feel instant, the UI should only be
  passed the last X messages by default
- Text input still feels a bit laggy on sessions page, might be due to the huge page height
- The text box is too small: it should be 7 lines by default and expand UP up to ~20 lines
- Links in messages (https://github.com/mrtolkien/uraeda/pull/21) should be clickable

## Why

The session is where the human follows and talks to the agent: it should feel instant.

## Notes

- When the agent was blocked due to auto mode in claude code, there was no way to know except
  visiting the session page -> I think that was fixed, check it
