---
status: awaiting-human
revision: 1
clarifications: 1
risk-tier: low
---

# Spec: Sidebar resize

> [!IMPORTANT]
>
> Spec to review, about 5 minutes.
>
> - You approve a handle the human drags, a thin line, as you picked in
>   [Q2](clarifications-01.md#q2-what-does-the-handle-look-like).

The sidebar's edge is a handle the human drags to resize it. Its stories are in
[the stories file](/packages/web/src/SidebarHandle.stories.tsx). See the [proposal](proposal.md)
and the [clarifications](clarifications-01.md).

## Decisions

Relied on: none.

## User stories

### US1: Resize the sidebar (P1)

Dragging the sidebar's edge resizes it, between 200 and 480 pixels wide.

[Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging)

Why this priority: it is the proposal.

Key scenarios:

1. **Given** the sidebar 280 pixels wide, **When** the human drags its edge 100 pixels to the right,
   **Then** it is 380 pixels wide.

More scenarios:

1. **Given** the sidebar 280 pixels wide, **When** the human drags its edge 100 pixels to the left,
   **Then** it stops at 200 pixels wide.

## Architecture

The handle is a component of the sidebar, which keeps the width in the layout.

- **Sidebar handle** draws the handle, and its drag:
  [Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging).

## Edge cases

| Importance | Situation                 | What happens   |
| ---------- | ------------------------- | -------------- |
| Normal     | A drag past 480 pixels    | it stops there |

## Success criteria

- **SC-001** (one frame): A drag follows the pointer within one frame.

## Assumptions

- The width is not saved between visits.

## Constitution check

| I. Humans stay in control |
| ------------------------- |
|            ✅             |

## Risk tier

**Low**: one component, no data.
