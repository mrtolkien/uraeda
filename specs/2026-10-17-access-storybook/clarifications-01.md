---
status: awaiting-human
---

# Clarifications, round 01: Storybook's full interface in Uraeda

> [!IMPORTANT]
>
> 3 questions, about 10 minutes.
>
> - The fix is one Storybook setting, now safe because of basic security's frame secret. It was
>   checked live in Chromium and WebKit: stories render, controls and hot reload work.
> - Where the setting goes lasts beyond this feature: in the skill's helper, it applies to every
>   project Uraeda previews.
> - Saving from controls and creating stories is a separate scope choice. Allowing it would let any
>   story's code, and any package it imports, write story files in the worktree and open an editor
>   on the machine running Uraeda.
> - Six points are settled without you, at the end, including that this stays a feature, as it was
>   started, though the proposal says "look at it as a change".

## Context

The [proposal](proposal.md) asks for Storybook's full interface in Uraeda: its sidebar, canvas,
controls, and panels, "all of storybooks features". It asks whether basic security makes this
simpler. Today the [Storybook page](/packages/web/src/StorybookPage.tsx) lists stories but renders
none. Story embeds, which show one story without Storybook's interface, work.

The cause, found in round 04 of the [UI iteration flow](/specs/done/2026-10-15-ui-iteration.md):
Uraeda shows previews only in sandboxed frames, which have no origin of their own, so a story's code
can never act as you in Uraeda. Since 10.6.2, Storybook's interface sends its messages to its story
frame only at the origin it expects, and the browser drops them in a sandbox. Storybook's
`security.insecureIframeMessaging` setting turns this off.

The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Q1: How should the Storybook page render stories?

Storybook added its origin check against one threat: a malicious website that frames your running
Storybook and sends it messages. Through Uraeda, a preview's address now holds the frame secret of
basic security, which only your signed-in pages receive, and Storybook's own port refuses to be
framed, so no other website can reach that position. A live experiment turned the setting on behind
a copy of Uraeda's proxy, in Chromium and WebKit. Stories rendered, controls updated them, the
sidebar navigated, Actions and Interactions showed, and hot reload worked, in about 2 seconds on a
warm Storybook. More in [discovery](discovery-01.md#rendering-stories-in-the-interface) and
[the guards relaxed](discovery-01.md#worth-it-and-feasibility).

Why it matters: it decides whether the page works at all, and whether any guard between a story's
code and your Uraeda session moves.

- **A (recommended). Turn on `insecureIframeMessaging` only when Uraeda serves the Storybook, and
  keep every frame sandboxed as it is.**
  - [pro] a few lines, checked in both browsers; a story's code can do nothing it cannot already do.
    At most, it could make the interface show another story or change its controls.
  - [con] Interactions' step-by-step debugger stays off, since the story frame has no shared origin
    with the interface; its steps still show.
  - Why recommended: basic security already closed what the setting guards against, so this is the
    smallest change that works.
- **B. Serve previews from a second origin, a second port of the Uraeda server, and let their frames
  keep that origin.**
  - [pro] Storybook works without the setting, debugger included, as Chromatic serves Storybooks on
    their own subdomain.
  - [con] a second listener, a second address for your reverse proxy or `tailscale serve` to
    publish, and changes to the guard, the proxy, and the sign-in decision; not tested.
- **C. Drop the sandbox of the Storybook page's frame.**
  - [pro] everything works, debugger included, with no setting.
  - [con] any story's code, and any package it imports, could act as you in Uraeda: approve specs,
    answer rounds, start agents, read every repository.
- **D. Keep the page as it is, list only.**
  - [pro] no work.
  - [con] the page stays broken.

**Answer:**

### Q1.A: Where is the setting turned on?

Only if you picked A in Q1. Every project that Uraeda previews wraps its Storybook config with the
skill's helper, [`uraeda-preview.js`](/skills/uraeda/assets/storybook/uraeda-preview.js), which
changes it only when Uraeda runs it. Storybook's own guidance says to avoid leaving the setting on
"for longer than strictly necessary". More in [discovery](discovery-01.md#where-the-flag-is-set).

Why it matters: in the helper, it applies to every project using Uraeda's previews, on their next
Storybook start.

- **A (recommended). In the skill's helper, only when Uraeda serves the Storybook.**
  - [pro] every project's Storybook page works, with one home for the rule; `storybook dev` on its
    own port stays as Storybook ships it.
  - [con] every project gets the setting without choosing it, though only behind Uraeda's frame
    secret.
  - Why recommended: the page is Uraeda's, so the setting it needs belongs to Uraeda's helper, not
    to each project.
- **B. In Uraeda's own `packages/web/.storybook/main.ts` only.**
  - [pro] other projects keep Storybook's defaults.
  - [con] other projects' Storybook pages stay broken until each adds the setting itself.

**Answer:**

## Q2: Can you save stories and create them from Storybook's interface?

Storybook's interface can save a story's controls back into its file, create a story file, search
components for a new story, and open a file in an editor. Uraeda turns these off on purpose: they go
through Storybook's live channel, and Storybook trusts whatever role a connection claims. Uraeda
cannot tell the interface's connection from a story's own code, which reads the same token. With
them off, saving shows "Failed to save story"; the experiment saw saving work once they were let
through. More in [discovery](discovery-01.md#file-writes-from-the-interface).

Why it matters: it decides whether "all of Storybook's features" includes editing files from the
browser, and who else could then write.

- **A (recommended). Keep them off: Storybook's interface reads and plays stories, and file changes
  go through the agent.**
  - [pro] a story's code can still write nothing; your edits reach the agent as comments on the
    stories, as today, never as uncommitted changes in its worktree.
  - [con] saving, creating, the "+" search, and opening in the editor fail with Storybook's own
    errors.
  - Why recommended: in Uraeda the agent writes the stories and you comment on them, so the writes
    give little, and they open a door to every story's code.
- **B. Turn them on: the proxy forwards the channel's role as asked.**
  - [pro] every Storybook feature works.
  - [con] any story's code, and any package a story imports, could overwrite or create story files
    in the worktree, and open any file in an editor on the machine running Uraeda; your saves land
    as uncommitted changes in the agent's worktree.
- **C. Turn them on for the interface only, with a secret that only the interface's page holds.**
  - [pro] writes work, and a story's code still cannot write.
  - [con] new proxy code that must keep the interface's page unreadable to the stories it runs,
    untested; opening in the editor stays useless on a remote server.

**Answer:**

## Settled without the human

- **This stays a feature**, as it was started with `discovery: high`, though the proposal says "look
  at it as a change": its spec and plan will be short, and a scope question (Q2) needed a round. See
  [discovery](discovery-01.md#a-change-or-a-feature).
- **Embeds do not change**: they load one story frame without Storybook's interface, and the setting
  does not reach their messages to Uraeda's page. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **Stories in the full interface follow the system's colour mode**, like Storybook's own screen:
  the page sends Uraeda's mode only to embeds, and the interface has its own theme. See
  [discovery](discovery-01.md#important-reads).
- **The hand validation script also opens the Storybook page's interface** through Uraeda in WebKit,
  and checks a story renders in its canvas: the browser tests' fake Storybook pins no origin, which
  is how the blank canvas went unnoticed. See [discovery](discovery-01.md#important-reads).
- **Older Storybooks need nothing**: before 10.6.2, nothing pins, and the setting is ignored. Not
  checked on an older version: the plan's first task checks it. See
  [discovery](discovery-01.md#needs-no-choice).
- **The interface on a phone's width** is Storybook's own mobile layout, not checked through Uraeda:
  the plan checks it, and anything broken there becomes a follow-up. See
  [discovery](discovery-01.md#worth-it-and-feasibility).

**Notes:**
