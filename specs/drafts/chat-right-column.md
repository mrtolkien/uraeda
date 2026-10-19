---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Chat's right column

## What

In a chat on a desktop, the right column is empty. It should hold what the chat did, from its tool
calls, since a chat may run on the main checkout, where git cannot tell the chat's changes apart.

- Files changed in the chat, and sources checked: files read, online links, searches.
- Running sub-agents, as a feature's column has.
- Suggest more good content, taking inspiration from existing chat web UIs.

## Why

The session is where the human follows the agent: the column says at a glance what it touched and
read.

## Notes

- Split from [Redesign session](/specs/done/2026-10-19-redesign-session.md), which settled the rest
  of the session page. Its discovery found that a stored tool call keeps its name, target, status,
  and the start of its output, and drops its raw input, so a diff needs inputs kept. See
  [its discovery](/specs/done/2026-10-19-redesign-session.md#q1b-what-should-a-chats-right-column-hold).
