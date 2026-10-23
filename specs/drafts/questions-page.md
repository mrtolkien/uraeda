---
discovery: medium # low, medium, or high: how far the agent researches before asking
---

# Questions page in the terminal look

## What

The round of questions, the most important page, redrawn in the look and shell of
[layout and look](../2026-10-20-layout-look/spec.md), with its tokens and panes.

- The context before the questions is the agent's first feedback on a feature: a clear, unique look
  and hierarchy, with icons, borders, and type that show what each paragraph holds.
- While answering, the question's text stays in view. Its context is extremely readable, with its
  own rendering for "Why it matters" and examples. "Check these" has high weight.
- Navigation and progress come second, then the session.
- Asking the feature's session about a question, from this page, reads well: the session takes the
  right column, as tabs beside the navigation, like Neovim's edgy.nvim, and not a cramped panel.

## Why

The human spends most of their time here, and the page grew view by view. Answers and sources:

- The information architecture:
  [the proposal](../2026-10-20-layout-look/proposal.md#clarifications).
- Where the session opens:
  [round 01's session question](../2026-10-20-layout-look/clarifications-01.md#q4-where-should-the-session-open-on-the-questions-page).
- The page stays one scroll, with a sticky question heading and an outline:
  [settled in round 01](../2026-10-20-layout-look/clarifications-01.md#settled-without-the-human).
