---
status: awaiting-human
---

# Clarifications, round 02: UI iteration flow

> [!IMPORTANT]
>
> 2 questions on live mockups, about 15 minutes.
>
> - **The size of the feature.** The Astryx mockups you asked about need a runtime of their own.
>   Building them now about doubles the feature, so the first question asks when to build them.
> - **How precise your comments on a live mockup can be.** That depends on a small script inside the
>   project's Storybook.
> - **13 points are settled without you**, at the end. They are how I read your round 01 answers and
>   your Storybook message. Check these first:
>   - mockups as stories, embedded in the spec;
>   - Uraeda running each worktree's Storybook;
>   - what is left of screenshots.

## Context

Your round 01 answers and your message after it changed the feature:

- **Live mockups in the spec**, to validate behaviour and UX before the code, with or without a
  question.
- **No screenshots**: "REAL, INTERACTIVE MOCKUPS".
- **Uraeda runs the project's preview** and embeds it.
- **Storybook for Uraeda**: "if we can integrate it _inside_ uraeda, or at least run it together and
  easily switch between the two, that would be godlike".

What this round found ([discovery](discovery-02.md)):

- **Storybook fits this repository.** Storybook 10.6.2 builds and runs on Vite+, React 19.3, the
  React Compiler, StyleX, and Vitest 5 in WebKit at both sizes, tested in a scratch project, with
  two workarounds. Astryx develops its own components in Storybook.
- **A story embeds by its address.** Storybook's `index.json` maps each story to its file and its
  export, so a spec can link a stories file and an export as plain markdown, readable on GitHub, and
  Uraeda can turn that link into a live embed.
- **Embedding is clean on another port.** A Storybook running on its own port is a separate origin,
  which keeps its code away from Uraeda's API, as Claude artifacts and MCP Apps do. Serving it from
  Uraeda's own server would need an exception to the stack decision's `Origin` rule.
- **The Astryx runtime is feasible.** Agent-written TSX can run against Astryx inside Uraeda: one
  prebuilt bundle of about 450 KB gzip, a transpiler Vite+ already ships, and a sandboxed origin of
  its own. It is a piece of work about the size of the rest of this feature.

The full investigation is in [discovery](discovery-02.md). Each question links to its topic.

## Q1: When does Uraeda render Astryx mockups itself?

Your Q2 answer in [round 01](clarifications-01.md) asked for Astryx mockups rendered by Uraeda "if
it's too hard to generate components in the project's target language". Storybook makes the
project's own code the mockup for every stack it supports: React, Vue, Svelte, Angular, Web
Components, and others. The Astryx runtime would serve the rest: Rails, Django, Phoenix, native
apps, and projects without a workbench. Its mockups have Astryx's look, not the project's. More in
[discovery](discovery-02.md#astryx-mockups-in-uraeda).

Why it matters: it sets this feature's size, and what projects without Storybook get.

- **A (recommended). Later, as its own feature. This feature covers Storybook, in Uraeda and in any
  project that has it. Projects without a preview environment keep HTML mockups, as today. A draft
  for the Astryx runtime goes into the backlog.**
  - [pro] one engine to build and get right first. Uraeda and every Storybook stack get live,
    real-code mockups now.
  - [con] Rails, Django, Phoenix, and native projects wait for live mockups.
  - Why recommended: Uraeda itself, the first user, is fully covered, and the runtime is better
    designed once embeds and comments exist.
- **B. Now, as the fallback for projects without a preview environment: agents write TSX mockups
  with Astryx components, and Uraeda renders them live, on a sandboxed origin of its own.**
  - [pro] every project with a UI gets live mockups at once.
  - [con] about doubles the feature: a runtime bundle, a transpiler, a second origin, and mockups to
    upgrade with each Astryx release.
- **C. Now, for every project, Uraeda included, in place of the project's own stories.**
  - [pro] one engine everywhere, with no setup in projects.
  - [con] mockups no longer use the project's code, so the picked variant cannot be kept as the
    starting point, as your Q2.A answer asked.

**Answer:**

## Q2: How precisely do you comment on a live mockup?

Uraeda cannot see inside a story served from another origin. Only code running inside the story's
frame can tell which element you clicked. Products that comment on live UI combine an element's
role, text, and a stable id. A pick mode must be separate from using the mockup, as in Figma Make.
No product documents a keyboard way to pick an element. A comment on the whole story always lands on
the spec's line that embeds it, as mockup comments do today. More in
[discovery](discovery-02.md#comment-precision-on-a-live-story).

Why it matters: it decides whether your small, targeted fixes can point at the exact element.

- **A (recommended). A pick mode. A small script in the project's Storybook preview, which the skill
  provides as a file to copy, highlights elements under the pointer and reports the one you click:
  its role, its accessible name, and its text. A comment on the whole story stays available, and it
  is the keyboard path.**
  - [pro] precise comments on any Storybook stack. The agent gets the element's role and name, not a
    guess from the text.
  - [con] one more file in each project's Storybook, and a pick mode to switch on and off.
  - Why recommended: precise feedback on the live UI is what you asked for, at the cost of one file.
- **B. A comment on the whole story only. Your text names the state and the element.**
  - [pro] nothing to add to projects.
  - [con] the agent must find the element from your words.
- **C. A spot on the frame, by its position.**
  - [pro] nothing to add to projects.
  - [con] a position on a live UI is lost as soon as the story changes or scrolls, and has no
    keyboard path.

**Answer:**

## Settled without the human

- **Mockups are stories.** A planned view is a stories file in the project's code, with one export
  per state, and one export per variant when there is a choice. The picked variant stays, and the
  others are deleted, per Q2.A of round 01.
- **Mockups live in the spec.** A link on a line of its own to a stories file and an export shows as
  the live story, embedded where it stands:
  - next to the user story it illustrates, as your Q1 answer asks;
  - `## Mockups` still lists every one.

  An example link is `[Repeat menu, open](/packages/web/src/RepeatMenu.stories.tsx#Open)`.

- **Variants in a round.** Each option of a visual question links its variant's story, and the
  questions view embeds it beside the option, as round 01's Q4 answer asks.
- **After the code.** The agent links the stories of the views it built in the pull request's
  description. You review them live, and your comments go to a review file that sends the branch
  back, as round 01's Q1.A answer says, with the precision of Q2.
- **Uraeda runs Storybook.** Uraeda's server starts a worktree's preview command on a free port, the
  first time a page embeds one of its stories, and stops it after 30 minutes without a view. Each
  embed has "Open in Storybook", which opens the same story in Storybook's own screen. This follows
  your Q5 answer and your message.
- **The stack decision changes.** Its server rules gain one: the server may run a project's own
  preview command, in its worktree, and embed it from its own port. The `Origin` rule is unchanged,
  since the preview runs on another origin.
- **Before a worktree's first preview**, the agent runs the project's setup, as the
  [git](/specs/decisions/git.md) decision already asks of every worktree.
- **The preview decision is optional.** It applies only to projects with a UI, as your Q3 answer
  says. It names three things:
  - the command that serves the states;
  - where the list of states is, which is `index.json` for Storybook;
  - the address of one state.

  The skill recommends Storybook where the stack supports it. Setup proposes the decision to a
  project with a UI. A discovery round on UI work asks for it once if it is missing.

- **Uraeda adopts Storybook**, as your Q6 answer says. It is pinned to exact versions, with
  telemetry off, and its build runs in `vp run ready`.
  - Its preview wraps stories in Uraeda's theme, as Astryx's own Storybook does.
  - Stories get their data from a fate client hydrated with snapshots of the real server on the
    fixture repository, so the data still comes from the server only, under the
    [stack](/specs/decisions/stack.md) decision.
- **Stories are previews, not tests.** Storybook's automatic test per story is off. A story becomes
  a test only when it guards a spec's scenario, as the [UI checks](/specs/decisions/ui-checks.md)
  decision requires.
- **Screenshots.** Variants need no images, so round 01's Q7 answer has nothing new to store. The
  screenshots the UI checks decision already requires stay as they are. The attachments decision
  does not change.
- **Projects without a preview environment** keep HTML mockups, embedded the same way, with A in Q1.
- **The questions view** puts an embedded story beside its option's button, never inside it, since a
  frame inside a button is invalid. Its `Question` component, near its size limit, is split first.

**Notes:**
