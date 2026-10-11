# CLI TUIs

## What

The answer, review, and draft screens of `ura`, built with ratatui on the commands of the
[CLI core features](../2026-10-10-cli-core/spec.md): `ura answer` walks through a round of
questions, `ura review` shows a spec or plan to comment on and approve, and `ura draft` picks a line
of `PRIORITIES.md`, each with a picker when several features wait. As the human wrote it in the
CLI's [proposal](../2026-10-10-cli-core/proposal.md):

> - Priorities.md bullet point to draft with TUI to pick the right priorities line
>   - `ura draft`
>   - The goal is to quickly pick an existing line written in priority and start working on it in a
>     real file
>   - The TUI then exits and open the created file with $EDITOR
> - Answer clarifications questions one by one (left/right to change question), with auto skip of
>   irrelevant questions (1.B if 1.A was picked for example)
>   - `ura answer` -> interative picker if multiple features are waiting for answers, otherwise open
>     the questions directly
>   - Interface should roughly be:
>     - Render the intro up to the first question, J/K, +/-, up down for vertical movement
>     - Right/L goes to the first question, left/right lets us navigate between questions, ... also
>       allow vi motions
>     - Typing ASCII characters goes directly in the response box, shift + enter for line jumps if
>       possible
>       - While typing left/right are for character navigation, enter/escape validates, and
>         left/right becomes useful for navigation again
>     - ctrl + g opens the $EDITOR to write down the response (like it does in codex or claude code)
>     - Some form of bottom reminder of shortcuts/mode so people are not lost. Take inspiration from
>       lazyvim's bottom bar, you can look at my nvim conf
> - Approve/comment on specs or plan
>   - `ura review` -> show picker if needed -> show the rendered file -> `Y` approves, `R` refuses,
>     `J/K`, `+/-`, and up/down arrows navigate the line. `C` comments, NOTING THE ACTIVE LINE.
>   - Same as above: iterative picker only if there are multiple unapproved files.
>
> We should then tell our skill/reference files to use the CLI for all workflow steps which will be
> less error prone than telling an agent what it needs to do.
>
> Use ratatui for TUI. Make the TUI coherent and beautiful: look for inspiration and make a mock.

## Why

The CLI core features moved these screens to their own feature, so agents got the commands first
([Q1](../2026-10-10-cli-core/clarifications-01.md#q1-what-does-this-feature-deliver)). The human
answered their design questions then:

- What `ura draft` creates:
  [Q4](../2026-10-10-cli-core/clarifications-01.md#q4-what-does-ura-draft-create)
- What `ura review` shows, and its active line:
  [Q12](../2026-10-10-cli-core/clarifications-01.md#q12-what-does-ura-review-show-and-what-is-the-active-line)
- How typing starts in `ura answer`:
  [Q13](../2026-10-10-cli-core/clarifications-01.md#q13-how-does-typing-start-in-ura-answer)
- What the TUIs look like, with a first mock:
  [Q14](../2026-10-10-cli-core/clarifications-01.md#q14-what-should-the-tuis-look-like)
- The libraries and keys settled without the human:
  [settled points](../2026-10-10-cli-core/clarifications-01.md#settled-without-the-human)

## Notes

The binary is about 4.1 MB after the CLI core features, against a 5 MB limit in CI; the TUI
libraries measured about 0.75 MB more.
