---
verdict: approved
commit: 18c6b8c
---

# Review: Spec, Questions page in the terminal look

## C1: Decision ui-layout, lines 35–48, under "Why"

> The desktop showed the phone's layout, and the human zoomed it to 120% to read it
> ([text size](../done/2026-10-12-ui-improvements.md#q5-how-large-should-text-be-on-desktop)). An
> agent's session, squeezed into a pane beside its list, was too narrow to follow. The human then
> asked for concepts over hard rules: "Goal #1 is always readability and clarity for the user"
> ([the session view's review](../done/2026-10-14-session-view.md#changes-after-approval)). The
> sidebar's rows of sub-agents and tasks were hard to read, so it became "small and visual more than
> textual"
> ([the sidebar's rows](../done/2026-10-16-redesign-interface.md#q4-how-does-a-features-step-show-on-its-row-before-implementation)).
> Half a screen, where the human often works, got the desktop's layout and broke: the human asked
> for a middle class, wide enough to hold their 1205 px half screen
> ([width classes](../done/2026-10-20-layout-look.md#q5-should-the-ui-get-a-third-width-class-for-half-screens)).
> Asking the agent about a question meant leaving the round for the session's page. The human asked
> for the session beside the documents they answer and review, in a column wide enough to read
> ([the session beside a document](../2026-10-24-questions-page/clarifications-01.md#q2-how-should-the-layout-decision-change-for-a-session-beside-a-document)).

Rewrite it as a simple, easy to read decision. History doesn't matter here: a decision is CURRENT
info.

## C2: Lines 246–247, under "Success criteria"

> - **SC-004** (phone width): At 390 px, a list's first-level text starts at the paragraphs' left
>   edge, and an option's text inside its border starts at most 11 px from the screen's edge.

Not the case in the mockup but that's a good rule
