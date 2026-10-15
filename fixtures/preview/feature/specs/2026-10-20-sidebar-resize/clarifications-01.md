---
status: awaiting-human
---

# Clarifications, round 01: Sidebar resize

> [!IMPORTANT]
>
> 2 questions on the sidebar's handle, about 5 minutes.
>
> - Q2 shows each handle live: pick the one you want.

## Context

The [proposal](proposal.md) asks for a sidebar the human resizes by dragging its edge.

## Q1: How wide can the sidebar get?

Why it matters: a wide sidebar takes the reading column's room.

- **A (recommended). Between 200 and 480 pixels.**
  - [pro] the reading column keeps its width on a laptop.
  - [con] long names are still cut past 480 pixels.
  - Why recommended: it fits a 1440 pixels wide screen.
- **B. Up to half the window.**
  - [pro] every name fits.
  - [con] the reading column shrinks.

**Answer:**

## Q2: What does the handle look like?

Why it matters: the handle is always on screen.

- **A (recommended). A thin line, which thickens under the pointer.**

  [Thin line](/packages/web/src/SidebarHandle.stories.tsx#ThinLine)

  - [pro] nothing new to see until the pointer is there.
  - [con] harder to find.
  - Why recommended: it keeps the sidebar quiet.
- **B. A grip of three dots, always shown.**

  [Grip](/packages/web/src/SidebarHandle.stories.tsx#Grip)

  - [pro] easy to find.
  - [con] one more thing on screen.

**Answer:**

## Settled without the human

- **The handle's colour** is the sidebar's border colour.

**Notes:**
