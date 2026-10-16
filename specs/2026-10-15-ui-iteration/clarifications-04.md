---
status: awaiting-human
---

# Clarifications, round 04: UI iteration flow

> [!IMPORTANT]
>
> 1 question on the full Storybook page, about 5 minutes.
>
> - **The Storybook page does not render stories through Uraeda.** Its list loads, but its canvas
>   and controls stay empty. The fix is a Storybook setting its own code calls insecure.
> - **Everything else is built.** All 13 tasks are done, the final review's findings are fixed, and
>   `vp run ready` passes. The pull request waits for this answer.
> - **Two points are settled without you**, at the end.

## Context

US5 builds Storybook's full interface into Uraeda's Storybook page. Uraeda serves every preview in a
sandboxed frame without an origin of its own, as the stack decision requires. Storybook's interface
talks to its story frame through `postMessage`, and in dev mode it pins each message to an origin
the sandboxed frame does not have, so the messages are dropped. Embeds, which show a story frame
alone, work. More in [discovery](discovery-04.md).

## Q1: How does Storybook's full interface work inside Uraeda?

Storybook's `security.insecureIframeMessaging` setting stops pinning those messages. The interface
then still accepts messages only from its own story frames, never from a page that embeds it. What
it gives up: a story frame that navigated to another site could still exchange messages with the
interface, and only the project's own story code can navigate that frame. More in
[discovery](discovery-04.md#storybooks-full-interface-inside-uraeda).

Why it matters: it decides whether the Storybook page you asked for works, at the cost of a setting
Storybook calls insecure, in every project's Storybook that Uraeda serves.

- **A (recommended). The skill's helper turns on `insecureIframeMessaging`, only when Uraeda serves
  the Storybook. Storybook on its own port keeps the default.**
  - [pro] the full interface works, through Tailscale too, with its canvas and controls.
  - [con] a story frame that navigated away could still message the interface.
  - Why recommended: the risk needs the project's own story code to navigate away, and the page is
    what you asked for.
- **B. "Open in Storybook" opens Storybook on its own port, in a new tab, and the Storybook page
  goes.**
  - [pro] Storybook keeps its default security.
  - [con] it works only on the computer that runs Uraeda, not from your phone.
- **C. Keep the page as it is, its list without stories, until basic security.**
  - [pro] nothing changes.
  - [con] the page you asked for does not work.

**Answer:**

## Settled without the human

- **The example's stories path** stays `/src/tasks/RepeatMenu.stories.tsx`, as the approved spec
  says, though the example puts components in `src/components/`. The example's preview decision only
  asks for stories under `src/`. See the rulings, R57.
- **The final review's other findings are fixed**, among them:
  - a website can no longer write files through Storybook's channel: the proxy opens it only as a
    preview;
  - Storybooks stop when the terminal closes, and those of a crashed server are killed at the next
    start;
  - a malformed connection no longer crashes the server.

  The pull request lists them all.

**Notes:**
