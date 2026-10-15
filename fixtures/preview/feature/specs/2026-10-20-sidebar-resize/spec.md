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
> - The handle is a thin line, as you picked in
>   [Q2](clarifications-01.md#q2-what-does-the-handle-look-like).

The sidebar's edge is a handle the human drags to resize it. Its stories are in
[the stories file](/packages/web/src/SidebarHandle.stories.tsx). See the [proposal](proposal.md)
and the [clarifications](clarifications-01.md).

## User stories

### US1: Resize the sidebar (P1)

Dragging the sidebar's edge resizes it, between 200 and 480 pixels wide.

[Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging)

Why this priority: it is the proposal.

Acceptance scenarios:

1. **Given** the sidebar 280 pixels wide, **When** the human drags its edge 100 pixels to the right,
   **Then** it is 380 pixels wide.

## Edge cases

- A drag past 480 pixels stops at 480.

## Success criteria

- **SC-001**: A drag follows the pointer within one frame.

## Architecture

The handle is a component of the sidebar, `SidebarHandle`, which keeps the width in the layout.

## Mockups

- [Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging): the handle as the
  human drags it.

## Assumptions

- The width is not saved between visits.

## Decisions

Relied on: none.

## Constitution check

| Principle                 | Complies | Notes                       |
| ------------------------- | -------- | --------------------------- |
| I. Humans stay in control | yes      | The human drags the handle. |

## Risk tier

**Low**: one component, no data.

## Details

### Data

The sidebar's width, in pixels, held by the layout.

### Components

- **Sidebar handle** (`packages/web/src/SidebarHandle.tsx`, new): the handle, and its drag.

### Error handling

None: a drag cannot fail.

### Testing

| What | Test                                    |
| ---- | --------------------------------------- |
| US1  | Browser test: drag the handle, read it. |
