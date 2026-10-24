---
status: awaiting-human
---

# Clarifications, round 01: Layout and look and feel

> [!IMPORTANT]
>
> 12 questions, about 35 minutes, plus about 15 minutes to try the mockups first.
>
> - Verdict: worth building, with changes: the markdown editor is a separate subsystem, and three
>   active decisions bind this redesign.
> - Open the [five mockups](mockups/compare.html) before the questions. They are clickable HTML over
>   the same data, checked at a desktop, a half screen, and a phone width.
> - Three answers last beyond this feature. They are the visual direction, the width classes (which
>   amend the layout decision), and prototypes in the workflow (which amend the preview decision).
> - Four questions work together: the direction, the mixed parts, the session beside a page, and the
>   width classes. The shell and the half-screen behaviour come from all four.
> - The mockups break the active preview decision, as your request asked. Prototypes are plain HTML,
>   not Storybook stories.
> - Three settled points need your check: keys are drawn but not built, the questions page stays one
>   scroll, and secondary text was corrected for contrast.
> - Not verified: the mockups were tested in Chromium only, not in Safari and not inside Uraeda's
>   own mockup frame.

## Context

### Goal

The [proposal](proposal.md) asks for one design pass over the whole web UI, for the one human who
uses it daily. The layout and the visual identity are decided together. You set what each view
shows. The agent builds several directions over that, and you pick one to write into the spec.

### Today

The UI is grey, with a black-and-white accent, and has no logo or favicon. It grew view by view. It
has one width breakpoint, at 768 px. A half screen of 960 px gets the desktop layout, where a
sidebar, a page, and a 320 px aside compete for the room.

| Part          | Today                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Shell         | A resizable side navigation in [Shell.tsx](/packages/web/src/Shell.tsx), 280 px wide by default     |
| Theme         | Astryx's neutral theme, built from [theme.ts](/packages/web/src/theme/theme.ts)                     |
| Width classes | Two, from [useWidthClass.ts](/packages/web/src/layout/useWidthClass.ts), switching at 768 px        |
| Home          | Tiles and lists in [Home.tsx](/packages/web/src/Home.tsx), with the sidebar's icons not reused      |
| Icons         | Lucide, 29 in the theme and 53 copied into [icons.ts](/packages/web/src/theme/icons.ts)             |
| The 5 h limit | A widget in [Allowance.tsx](/packages/web/src/sidebar/Allowance.tsx), hidden when the sidebar folds |

The merge-chats feature, merged before this one, already makes "session" the one concept that grows
into a change and then a feature. It also adds the New page and removes the feature colour. This
feature builds on that.

### Scope

All the views of your information architecture, the shell, the visual identity (colours, shapes,
type, a logo, a favicon), the icons, and the harness marks. It leaves out new features and any
change to what the views do. The markdown proposal editor is Q1.

### Sources

- The [current UI code](/packages/web/src/) and its sandbox of sample projects.
- The active decisions on [layout](/specs/decisions/ui-layout.md),
  [components](/specs/decisions/ui-components.md), [preview](/specs/decisions/preview.md), and
  [stack](/specs/decisions/stack.md).
- DeepSeek Harness, Kiro Crew, Zed, and the agent tools' own apps. Apple's Liquid Glass material.
  Japanese bonsai and colour sources. Your own two sites and your Neovim screenshots.
- Markdown editor tests, run on this repository's own files.
- The full investigation is in [discovery](discovery-01.md). Each question links its topic.
- The mockups are described in [their README](mockups/README.md).

## Check these

- **Keyboard keys in the terminal look** are drawn and not built. If you pick that direction, its
  keys (`j` and `k`, a leader key, key hints) stay out, since keyboard navigation is its own item in
  the [priorities](/specs/PRIORITIES.md). The layout still takes the look.
- **The questions page stays one scroll**, with a sticky question heading and an outline, not one
  question per screen. The evidence for one question at a time is mixed, and later questions refer
  back to earlier ones. You also asked to always see the question while answering. See
  [discovery](discovery-01.md#needs-no-choice).
- **Text contrast** is held at 4.5:1 for text, and 3:1 for large text and controls. Several of the
  agent's own first colours missed it, so the secondary text in every mockup was corrected after
  measuring. Decorative marks, like the dim grid lines, are not text.

## Q4: Where should the session open on the questions page?

You want to ask the agent about the question in front of you, from that page, and read the answer
without a cramped panel. Today the session is a side panel. The mockups show three ways. Natural and
glass use a bottom sheet with three heights. Cyber and blueprint use a panel from the right.
Terminal uses a split below the page. Astryx already ships a bottom sheet with snap points and a
resizable panel. More in [discovery](discovery-01.md#the-session-beside-a-document).

Example: you are on a question about the next occurrence of a repeating task. You ask, "Why does
option C cost more?", and want the answer beside the question you are weighing.

Why it matters: it decides how much of the question stays visible while you read the answer. At half
screen a right panel leaves little width for the question.

- **A (recommended). A resizable panel on the right at wide widths, and a bottom sheet with three
  heights at medium and narrow widths.**
  - [pro] at full width you see the question and the answer side by side. At half screen the sheet
    keeps the question above it, and it goes opaque when expanded.
  - [con] two layouts to build and test, though both exist as Astryx components.
  - Why recommended: it keeps the question visible at every width, which you asked for.
- **B. Always a bottom sheet, with a peek, a half, and a full height.**
  - [pro] one layout at every width, and the answer can take the whole screen when you need it.
  - [con] on a wide screen the question sits half hidden above the sheet.
- **C. Always a floating panel from the right, over the page.**
  - [pro] the questions keep their width, and the panel can be dismissed at once.
  - [con] it covers the right edge of the page, and on a phone it fills the screen.
- **D. A separate page for the session.**
  - [pro] the simplest, and the session gets the whole width.
  - [con] you leave the question to read the answer, which is what you want to avoid.

**Answer:**

## Q5: Should the UI get a third width class for half screens?

The [layout decision](/specs/decisions/ui-layout.md) fixes two width classes, switching at 768 px,
and says views adapt "through the theme and never per-view media queries". Half of a 1920 px screen
is 960 px. The desktop layout there puts the sidebar, the page, and a 320 px aside side by side. The
tests only run at 402 and 1440 px. Material 3 calls 840 to 1199 px its "expanded" class, where a
rail replaces the drawer. More in [discovery](discovery-01.md#width-classes).

Why it matters: this is the fix for the layout that breaks at half a screen's width. It amends an
active decision, and every view's tests follow the classes you pick.

- **A (recommended). Add a middle class from about 840 to 1199 px, where the sidebar folds to icons
  and an aside opens as an overlay.**
  - [pro] it fixes half screen directly, and the mockups were built and checked at that width.
  - [con] a third layout per view, and the tests must run at about 960 px as well.
  - Why recommended: half screen is how you use the app, so it should be a class, not a patch.
- **B. Keep two classes and move the switch up to about 1024 px.**
  - [pro] no new layout to build.
  - [con] at 960 px you get the phone layout on a wide window, which wastes the screen.
- **C. Keep two classes, and let each pane adapt by its own width with container queries.**
  - [pro] panes adapt wherever they sit, with no class to test.
  - [con] it needs a ruling on the decision's "never per-view" rule, and each pane is tested alone.

**Answer:**

## Settled without the human

### Behaviour

- **The shell shows the same things at every width.** The inbox draft, New, running sessions,
  features in progress, the 5 h limit, and the settings stay one tap away. At half screen the shell
  folds to icons and counts, and it never hides them.
- **A "reduce effects" setting** turns off glass blur, parallax, glitch, and textures, alongside the
  system's reduced-motion setting. Safari does not support the reduced-transparency setting.
- **The New page** shows its three choices as three differently shaped cards, in the picked
  direction's art. The flow behind them belongs to the merge-chats feature.
- **The feature colour** is already removed by merge-chats, so nothing is left to remove here. The
  Storybook link on a feature's page is removed, as you asked.
- **The inbox** stays a categorised list you can reorder, with categories you can create and delete.
  Its notes show whole, and a note's actions sit beside it.
- **Decisions come first in a spec**, with their changes marked. A live preview is always framed and
  labelled, so it cannot be mistaken for the document.
- **Priorities and the inbox** get menu actions to move a line, beside dragging.

### Under the hood

- **Tokens** go through Astryx's theme levers where they exist. What they cannot hold, like a
  texture or a tree drawing, is listed in the plan's complexity tracking.
- **The prototypes** stay in this feature's `mockups/` folder until the spec, where Q6's answer
  decides their fate.
- **The mockups' fake data** comes from this repository's own files, so they can be checked against
  the real UI.

**Notes:**
